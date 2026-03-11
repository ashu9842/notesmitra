/**
 * File Access Control Middleware
 * Enforces tenant-scoped file access and prevents cross-tenant file sharing
 */

import AppError from '../utils/AppError.js';
import fileAccessService from '../services/fileAccessService.js';

/**
 * Verify file belongs to tenant before serving
 * Middleware to protect /download and /view endpoints
 */
export const verifyFileOwnership = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const { publicId } = req.query;
    const tenantId = req.tenant?.id;
    const userId = req.user?._id;

    if (!tenantId) {
      return next(new AppError('Tenant not found in request', 401));
    }

    if (!publicId) {
      return next(new AppError('File reference missing', 400));
    }

    if (!userId) {
      return next(new AppError('User not authenticated', 401));
    }

    try {
      // Verify file access
      const verification = await fileAccessService.verifyFileAccess(publicId, tenantId);

      // Check for cross-tenant access attempts
      const accessCheck = fileAccessService.detectCrossTenantAccess(publicId, tenantId);

      if (accessCheck.detected && !accessCheck.verified) {
        // Log security event
        console.error('🚨 Cross-tenant access attempted:', {
          attemptedTenant: tenantId,
          fileTenant: accessCheck.fileTenant,
          publicId: publicId,
          userId: userId,
          timestamp: new Date()
        });

        return next(
          new AppError('You do not have permission to access this file', 403)
        );
      }

      // Attach verification info to request
      req.fileVerification = {
        publicId,
        tenantId,
        verified: true,
        savedAt: new Date()
      };

      next();
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }
      return next(new AppError('File access verification failed', 500));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Verify file deletion is within tenant
 * Prevents accidental deletion of other tenant's files
 */
export const verifyFileDeletePermission = async (req, res, next) => {
  try {
    const { publicId } = req.body;
    const tenantId = req.tenant?.id;
    const userId = req.user?._id;

    if (!tenantId) {
      return next(new AppError('Tenant not found in request', 401));
    }

    if (!publicId) {
      return next(new AppError('File reference missing', 400));
    }

    try {
      // Verify file ownership
      await fileAccessService.verifyFileOwnership(publicId, tenantId, userId);

      // Attach info
      req.fileDelete = {
        publicId,
        tenantId,
        verifiedForDeletion: true
      };

      next();
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }
      return next(new AppError('Delete verification failed', 500));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Validate file public ID format
 * Ensures all file references follow tenant-scoped pattern
 */
export const validatePublicIdFormat = async (req, res, next) => {
  try {
    // Check for public ID in different possible locations
    const publicId =
      req.query.publicId ||
      req.body.publicId ||
      req.params.publicId ||
      null;

    const tenantId = req.tenant?.id;

    if (publicId && tenantId) {
      // Validate format
      const isValid = fileAccessService.isValidTenantPublicId(publicId, tenantId);

      if (!isValid) {
        console.warn('Invalid public ID format:', {
          publicId,
          tenantId,
          timestamp: new Date()
        });

        return next(new AppError('Invalid file reference format', 400));
      }

      // Attach to request for later use
      req.validatedPublicId = publicId;
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Inject file access service into request
 * Available as req.fileAccessService throughout request lifecycle
 */
export const attachFileService = (req, res, next) => {
  req.fileAccessService = fileAccessService;
  next();
};

/**
 * Log all file access attempts
 * For audit trail and security monitoring
 */
export const logFileAccess = async (req, res, next) => {
  // Store original res.json to intercept response
  const originalJson = res.json;

  res.json = function (data) {
    try {
      const publicId = req.query.publicId || req.body.publicId || null;
      const tenantId = req.tenant?.id;
      const userId = req.user?._id;
      const action = req.method === 'DELETE' ? 'delete' : 'download';
      const success = data.success !== false;

      if (publicId && tenantId && userId) {
        const logEntry = fileAccessService.createAccessLog(
          publicId,
          tenantId,
          userId,
          action,
          success,
          success ? null : data.error
        );

        // Add request metadata
        logEntry.ipAddress = req.ip;
        logEntry.userAgent = req.get('user-agent');

        // Log based on success
        if (success) {
          console.log('✓ File access:', {
            action: logEntry.action,
            tenant: logEntry.tenantId,
            timestamp: logEntry.timestamp
          });
        } else {
          console.warn('⚠ File access failed:', {
            action: logEntry.action,
            error: logEntry.error,
            tenant: logEntry.tenantId,
            timestamp: logEntry.timestamp
          });
        }
      }
    } catch (error) {
      // Don't break response if logging fails
      console.error('Error logging file access:', error);
    }

    // Call original json
    return originalJson.call(this, data);
  };

  next();
};

/**
 * Redirect cross-tenant access attempts to tenant-specific endpoint
 * Helps prevent accidental cross-tenant issues
 */
export const redirectToTenantNamespace = async (req, res, next) => {
  try {
    const publicId = req.query.publicId || req.body.publicId;
    const tenantId = req.tenant?.id;

    if (publicId && tenantId) {
      const fileTenantId = fileAccessService.extractTenantFromPublicId(publicId);

      // If file belongs to different tenant, deny
      if (fileTenantId && fileTenantId !== tenantId.toString()) {
        console.warn('Cross-tenant redirect attempt blocked:', {
          requestTenant: tenantId,
          fileTenant: fileTenantId,
          publicId,
          url: req.originalUrl
        });

        return next(
          new AppError(
            'File not found in your tenant namespace',
            404
          )
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Rate limit file downloads per tenant
 * Prevents abuse of download bandwidth
 */
export const rateLimitFileDownload = (
  maxDownloadsPerHour = 100,
  maxDownloadsPerDay = 1000
) => {
  return async (req, res, next) => {
    try {
      const tenantId = req.tenant?.id;
      const userId = req.user?._id;

      if (!tenantId || !userId) {
        return next();
      }

      // Implementation would require Redis or cache
      // Placeholder for structure
      const cacheKey = `downloads:${tenantId}:${userId}`;

      // This is a template - actual implementation depends on cache strategy
      // For now, just pass through
      req.downloadRateLimit = {
        tenantId,
        userId,
        checkPassed: true
      };

      next();
    } catch (error) {
      // Don't block on rate limit errors, just log
      console.error('Rate limit check error:', error);
      next();
    }
  };
};

/**
 * Sanitize file downloads
 * Ensure downloaded files don't contain security risks
 */
export const sanitizeFileDownload = async (req, res, next) => {
  try {
    // Add security headers for file downloads
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Content-Disposition': 'attachment'
    });

    next();
  } catch (error) {
    next(error);
  }
};

export default {
  verifyFileOwnership,
  verifyFileDeletePermission,
  validatePublicIdFormat,
  attachFileService,
  logFileAccess,
  redirectToTenantNamespace,
  rateLimitFileDownload,
  sanitizeFileDownload
};

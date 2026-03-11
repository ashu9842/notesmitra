/**
 * File Access Service
 * Manages tenant-scoped file access, signed URLs, and cross-tenant prevention
 */

import AppError from '../utils/AppError.js';
import { generateSignedUrl, deleteFromCloudinary, getCloudinaryFileInfo } from '../config/cloudinary.js';
import { getTenantContext } from '../utils/tenantContext.js';

class FileAccessService {
  /**
   * Get tenant-scoped folder path for Cloudinary
   * Format: notesmitra/{tenantId}/notes/
   */
  getTenantFolderPath(tenantId, type = 'notes') {
    if (!tenantId) {
      throw new AppError('Tenant ID is required', 400);
    }
    return `notesmitra/${tenantId}/${type}`;
  }

  /**
   * Extract tenant ID from Cloudinary public ID
   * Format: notesmitra/{tenantId}/notes/{filename}
   */
  extractTenantFromPublicId(publicId) {
    try {
      const parts = publicId.split('/');
      if (parts.length >= 3 && parts[0] === 'notesmitra') {
        return parts[1];
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify if current user has access to file
   * Checks: file belongs to tenant, user is from that tenant
   */
  async verifyFileAccess(publicId, requesterTenantId) {
    try {
      // Verify public ID contains tenant information
      const fileTenantId = this.extractTenantFromPublicId(publicId);

      if (!fileTenantId) {
        throw new AppError('Invalid file reference', 400);
      }

      // Verify file belongs to requester's tenant
      if (fileTenantId !== requesterTenantId.toString()) {
        throw new AppError(
          'You do not have permission to access this file',
          403
        );
      }

      return {
        verified: true,
        tenantId: fileTenantId,
        publicId: publicId
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('File access verification failed', 500);
    }
  }

  /**
   * Generate tenant-scoped signed URL for file download
   * URL expires after specified time and is verified with tenant context
   */
  generateTenantSignedUrl(publicId, requesterTenantId, expiresIn = 3600) {
    try {
      // Verify tenant access
      const fileTenantId = this.extractTenantFromPublicId(publicId);

      if (!fileTenantId) {
        throw new AppError('Invalid file reference format', 400);
      }

      if (fileTenantId !== requesterTenantId.toString()) {
        throw new AppError(
          'Cannot generate signed URL for file outside your tenant',
          403
        );
      }

      // Generate signed URL
      const signedUrl = generateSignedUrl(publicId, expiresIn);

      return {
        success: true,
        url: signedUrl,
        expiresIn,
        tenantId: fileTenantId,
        expiresAt: new Date(Date.now() + expiresIn * 1000)
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to generate signed URL', 500);
    }
  }

  /**
   * Get list of files accessible by tenant
   * Returns only files that belong to tenant
   */
  async getTenantFiles(tenantId, type = 'notes', limit = 100) {
    try {
      const folderPath = this.getTenantFolderPath(tenantId, type);

      // Query Cloudinary API for resources in tenant folder
      // Note: Actual implementation depends on Cloudinary API version
      // This is a placeholder for the structure

      return {
        success: true,
        folderPath,
        tenantId,
        type,
        message: 'Tenant file listing endpoint (implement based on Cloudinary SDK)'
      };
    } catch (error) {
      throw new AppError('Failed to list tenant files', 500);
    }
  }

  /**
   * Verify file ownership and tenant access
   * Used before delete operations
   */
  async verifyFileOwnership(publicId, requesterTenantId, requesterUserId) {
    try {
      // First verify tenant access
      const accessVerification = await this.verifyFileAccess(publicId, requesterTenantId);

      if (!accessVerification.verified) {
        throw new AppError('File access denied', 403);
      }

      // Additional check: Verify with database model if needed
      // This should be called from controller with Note model

      return {
        verified: true,
        publicId,
        tenantId: requesterTenantId,
        userId: requesterUserId
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('File ownership verification failed', 500);
    }
  }

  /**
   * Delete file with tenant verification
   */
  async deleteFileWithTenantCheck(publicId, requesterTenantId, requesterUserId) {
    try {
      // Verify ownership first
      await this.verifyFileOwnership(publicId, requesterTenantId, requesterUserId);

      // Proceed with deletion
      const result = await deleteFromCloudinary(publicId, 'auto');

      if (!result.success) {
        throw new AppError('Failed to delete file from storage', 500);
      }

      return {
        success: true,
        publicId,
        deleted: true,
        message: 'File deleted successfully'
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('File deletion failed', 500);
    }
  }

  /**
   * Get file info with tenant verification
   */
  async getFileInfoWithTenantCheck(publicId, requesterTenantId) {
    try {
      // Verify tenant access
      await this.verifyFileAccess(publicId, requesterTenantId);

      // Get file info from Cloudinary
      const fileInfo = await getCloudinaryFileInfo(publicId);

      return {
        ...fileInfo,
        tenantId: requesterTenantId,
        verified: true
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to retrieve file information', 500);
    }
  }

  /**
   * Validate public ID format
   * Ensures public ID follows tenant-scoped pattern
   */
  isValidTenantPublicId(publicId, expectedTenantId = null) {
    try {
      const parts = publicId.split('/');

      // Check format: notesmitra/{tenantId}/{type}/{filename}
      if (parts.length < 3 || parts[0] !== 'notesmitra') {
        return false;
      }

      const tenantId = parts[1];

      // Verify tenant ID is valid ObjectId format
      if (!this.isValidObjectId(tenantId)) {
        return false;
      }

      // If expected tenant provided, verify match
      if (expectedTenantId && tenantId !== expectedTenantId.toString()) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if string is valid MongoDB ObjectId
   */
  isValidObjectId(id) {
    return /^[0-9a-fA-F]{24}$/.test(id.toString());
  }

  /**
   * Generate file access log entry
   * For audit trail of file accesses
   */
  createAccessLog(publicId, requesterTenantId, requesterUserId, action, success, error = null) {
    return {
      publicId,
      tenantId: requesterTenantId,
      userId: requesterUserId,
      action, // 'download', 'delete', 'view', 'share'
      success,
      error: error ? error.message : null,
      timestamp: new Date(),
      ipAddress: null, // To be filled by middleware
      userAgent: null  // To be filled by middleware
    };
  }

  /**
   * Check if file is accessible outside tenant
   * Returns security warnings if improper access detected
   */
  detectCrossTenantAccess(publicId, requesterTenantId) {
    const fileTenantId = this.extractTenantFromPublicId(publicId);

    if (!fileTenantId) {
      return {
        detected: true,
        severity: 'high',
        message: 'Invalid public ID format detected'
      };
    }

    if (fileTenantId !== requesterTenantId.toString()) {
      return {
        detected: true,
        severity: 'critical',
        message: 'Cross-tenant access attempted',
        attemptedTenant: requesterTenantId,
        fileTenant: fileTenantId
      };
    }

    return {
      detected: false,
      verified: true
    };
  }
}

export default new FileAccessService();

/**
 * Plan Limits Enforcement Middleware
 * Validates tenant plan limits before operations
 */
import { getPlanLimits } from '../config/planLimits.js';
import logger from '../utils/logger.js';

/**
 * Check user limit before adding new user to tenant
 */
export const checkUserLimit = async (req, res, next) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context required'
      });
    }

    const { planLimitsService } = req;
    if (!planLimitsService) {
      return res.status(500).json({
        success: false,
        message: 'Plan limits service not available'
      });
    }

    await planLimitsService.canAddUser(req.tenant.id);
    next();
  } catch (error) {
    logger.error('User limit check failed:', error);
    return res.status(error.statusCode || 403).json({
      success: false,
      message: error.message,
      code: error.code
    });
  }
};

/**
 * Check upload limit before creating new note
 */
export const checkUploadLimit = async (req, res, next) => {
  try {
    if (!req.tenant) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context required'
      });
    }

    const { planLimitsService } = req;
    if (!planLimitsService) {
      return res.status(500).json({
        success: false,
        message: 'Plan limits service not available'
      });
    }

    await planLimitsService.canUploadNote(req.tenant.id);
    next();
  } catch (error) {
    logger.error('Upload limit check failed:', error);
    return res.status(error.statusCode || 403).json({
      success: false,
      message: error.message,
      code: error.code
    });
  }
};

/**
 * Check storage limit before uploading file
 * Expects req.body.fileSizeGB or calculates from file
 */
export const checkStorageLimit = (fileSizeGBField = 'fileSizeGB') => {
  return async (req, res, next) => {
    try {
      if (!req.tenant) {
        return res.status(400).json({
          success: false,
          message: 'Tenant context required'
        });
      }

      const { planLimitsService } = req;
      if (!planLimitsService) {
        return res.status(500).json({
          success: false,
          message: 'Plan limits service not available'
        });
      }

      let fileSizeGB = req.body[fileSizeGBField];

      // If not provided, try to calculate from uploaded file
      if (!fileSizeGB && req.file) {
        fileSizeGB = (req.file.size / (1024 * 1024 * 1024)).toFixed(3); // Convert bytes to GB
      }

      if (!fileSizeGB) {
        return res.status(400).json({
          success: false,
          message: 'File size information required'
        });
      }

      await planLimitsService.canStoreFile(req.tenant.id, parseFloat(fileSizeGB));
      next();
    } catch (error) {
      logger.error('Storage limit check failed:', error);
      return res.status(error.statusCode || 403).json({
        success: false,
        message: error.message,
        code: error.code
      });
    }
  };
};

export default {
  checkUserLimit,
  checkUploadLimit,
  checkStorageLimit
};

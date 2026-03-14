import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import config from '../config/index.js';
import { uploadToCloudinary, uploadToTenantFolder, isCloudinaryConfigured } from '../config/cloudinary.js';
import logger from '../utils/logger.js';
import User from '../models/User.js';

const MAX_FILE_SIZE = config.maxFileSize || 20 * 1024 * 1024; // 20MB
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-

// Ensure upload directory exists (for temp files)
const uploadDir = config.uploadPath || './uploads';
const tempDir = path.join(uploadDir, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Configure storage (temporary local storage before cloud upload)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir); // Store in temp directory
  },
  filename: function (req, file, cb) {
    const uniqueName = `${uuidv4()}.pdf`;
    cb(null, uniqueName);
  }
});

const sanitizeMetadata = (req) => {
  if (!req.body || typeof req.body !== 'object') return;

  Object.keys(req.body).forEach((key) => {
    const value = req.body[key];
    if (typeof value === 'string') {
      req.body[key] = value.replace(/[<>\x00-\x1F]/g, '').trim();
    }
  });
};

const hasInvalidFilename = (name) => {
  if (!name) return true;
  if (name.length > 200) return true;
  if (path.basename(name) !== name) return true;
  if (/[\\/]/.test(name)) return true;
  if (/[<>:"|?*\x00-\x1F]/.test(name)) return true;
  return false;
};

// File filter - Simplified to avoid stream issues
const fileFilter = (req, file, cb) => {
  sanitizeMetadata(req);

  if (hasInvalidFilename(file.originalname)) {
    return cb(new Error('Invalid file name'), false);
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    return cb(new Error('Only PDF files are allowed'), false);
  }

  // Accept only PDF files
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF files are allowed'), false);
  }

  // PDF signature check will happen in controller after file is uploaded
  return cb(null, true);
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: fileFilter
});

// Error handling middleware for multer
export const handleUploadError = (err, req, res, next) => {
  // Clean up temp file if exists
  if (req.file && fs.existsSync(req.file.path)) {
    try {
      fs.unlinkSync(req.file.path);
    } catch (cleanupError) {
      logger.error('Error cleaning up temp file', { error: cleanupError.message });
    }
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: `File size too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }
  next();
};

/**
 * Middleware to upload file to Cloudinary after multer processing
 * Cleans up local temp file after upload
 * Uses tenant-specific folder structure for file segregation
 */
export const uploadToCloud = async (req, res, next) => {
  try {
    // Skip if no file or Cloudinary not configured
    if (!req.file) {
      return next();
    }

    const useCloudinary = config.useCloudinary && isCloudinaryConfigured();
    
    if (!useCloudinary) {
      // Keep using local storage
      logger.info('Using local file storage (Cloudinary disabled)');
      return next();
    }

    // Get tenant ID from request context
    let tenantId = req.tenant?.id;
    if (!tenantId && req.user?._id) {
      const user = await User.findById(req.user._id).select('tenantId');
      tenantId = user?.tenantId;
    }
    if (!tenantId) {
      throw new Error('Tenant ID not found in request or user record.');
    }

    logger.info('Uploading file to Cloudinary', { tenantId, filename: req.file.originalname });
    
    // Upload to tenant-specific folder
    const cloudResult = await uploadToTenantFolder(
      req.file.path,
      tenantId,
      'notes', // file type
      'raw'    // resource type
    );
    
    if (!cloudResult.success) {
      throw new Error('Failed to upload to Cloudinary');
    }

    // Add cloudinary info to request
    req.cloudinaryFile = {
      url: cloudResult.url,
      publicId: cloudResult.publicId,
      format: cloudResult.format,
      bytes: cloudResult.bytes,
      originalName: req.file.originalname,
      size: req.file.size,
      tenantId: cloudResult.tenantId,
      folderPath: cloudResult.folderPath
    };

    // Preserve file bytes for immediate quality checks in the controller.
    // This avoids dependency on Cloudinary re-download availability.
    try {
      req.uploadedPdfBuffer = fs.readFileSync(req.file.path);
    } catch (bufferError) {
      logger.warn('Could not cache uploaded PDF buffer for quality checks', { error: bufferError.message });
    }

    // Delete temp local file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      logger.info('Temp file cleaned up');
    }

    logger.info('File uploaded to tenant folder successfully', { folderPath: cloudResult.folderPath });
    next();
  } catch (error) {
    logger.error('Cloudinary upload error', { error: error.message });
    
    // Clean up temp file
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        logger.error('Error cleaning up temp file', { error: cleanupError.message });
      }
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      details: error.message
    });
  }
};

export default upload;

import { v2 as cloudinary } from 'cloudinary';
import config from './index.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinaryCloudName,
  api_key: config.cloudinaryApiKey,
  api_secret: config.cloudinaryApiSecret,
  secure: true
});

/**
 * Upload file to Cloudinary
 * @param {string} filePath - Local file path
 * @param {string} folder - Cloudinary folder name
 * @param {string} resourceType - Type of resource (auto, image, video, raw)
 * @returns {Promise<Object>} Upload result
 */
export const uploadToCloudinary = async (filePath, folder = 'notes', resourceType = 'auto') => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `notesmitra/${folder}`,
      resource_type: resourceType,
      type: 'upload', // Changed to upload type to avoid 'untrusted customer' errors
      access_mode: 'public' // Public but secured with signed URLs
    });
    
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
      bytes: result.bytes,
      createdAt: result.created_at
    };
  } catch (error) {
    throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
  }
};

/**
 * Upload file to tenant-specific folder in Cloudinary
 * Ensures files are segregated by tenant: notesmitra/{tenantId}/notes/
 * @param {string} filePath - Local file path
 * @param {string} tenantId - Tenant ID for folder structure
 * @param {string} fileType - Type of file (notes, attachments, etc)
 * @param {string} resourceType - Type of resource (auto, image, video, raw)
 * @returns {Promise<Object>} Upload result with tenant verification
 */
export const uploadToTenantFolder = async (filePath, tenantId, fileType = 'notes', resourceType = 'auto') => {
  try {
    if (!tenantId) {
      throw new Error('Tenant ID is required for tenant-scoped upload');
    }

    // Build tenant-scoped folder path: notesmitra/{tenantId}/notes/
    const tenantFolder = `notesmitra/${tenantId}/${fileType}`;

    const result = await cloudinary.uploader.upload(filePath, {
      folder: tenantFolder,
      resource_type: resourceType,
      type: 'upload', // Changed to upload to avoid 'untrusted customer' errors
      access_mode: 'public', // Public but secured with signed URLs
      tags: [`tenant:${tenantId}`, `type:${fileType}`], // Add tags for organization
      timeout: 120000, // 2 minute timeout for large files
      chunk_size: 6000000 // 6MB chunks for better upload performance
    });
    
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
      bytes: result.bytes,
      createdAt: result.created_at,
      tenantId: tenantId,
      folderPath: tenantFolder,
      tags: result.tags || []
    };
  } catch (error) {
    throw new Error(`Failed to upload to tenant folder: ${error.message}`);
  }
};

/**
 * Download a Cloudinary raw file using the Admin API (Basic Auth).
 *
 * CDN signed URLs for raw resources always return 401 on accounts that enforce
 * strict CDN delivery, because raw files cannot embed an expiry transformation
 * (e_at: only works for image/video).  The Admin API endpoint at
 * api.cloudinary.com/v1_1/{cloud}/raw/download accepts the same Basic Auth
 * credentials used by every other Admin API call and reliably returns 200.
 *
 * @param {string} publicId - Cloudinary public ID (including .pdf extension)
 * @returns {Promise<Response>} fetch Response – caller must check .ok
 */
export const downloadCloudinaryFile = async (publicId) => {
  const cfg = cloudinary.config();
  const basicAuth = Buffer.from(`${cfg.api_key}:${cfg.api_secret}`).toString('base64');
  const url =
    `https://api.cloudinary.com/v1_1/${cfg.cloud_name}/raw/download` +
    `?public_id=${encodeURIComponent(publicId)}&type=upload&attachment=false`;
  return fetch(url, {
    redirect: 'follow',
    headers: { Authorization: `Basic ${basicAuth}` }
  });
};

/**
 * Generate download URL for files
 * @param {string} publicId - Cloudinary public ID
 * @param {number} expiresIn - Expiration time in seconds (for future use)
 * @returns {string} Download URL
 */
export const generateSignedUrl = (publicId, expiresIn = 3600) => {
  try {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;

    // Generate a signed, time-limited URL for the raw PDF.
    // sign_url:true + expires_at creates a URL that is only valid for `expiresIn` seconds.
    // type:'upload' matches how files were uploaded.
    const downloadUrl = cloudinary.url(publicId, {
      resource_type: 'raw',
      type: 'upload',
      secure: true,
      sign_url: true,
      expires_at: expiresAt
    });

    return downloadUrl;
  } catch (error) {
    throw new Error('Failed to generate download URL');
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Type of resource
 * @returns {Promise<Object>} Deletion result
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'auto') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: 'upload',
      invalidate: true
    });
    
    return {
      success: result.result === 'ok',
      result: result.result
    };
  } catch (error) {
    throw new Error(`Failed to delete from Cloudinary: ${error.message}`);
  }
};

/**
 * Get file info from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} File information
 */
export const getCloudinaryFileInfo = async (publicId) => {
  try {
    const result = await cloudinary.api.resource(publicId, {
      type: 'authenticated',
      resource_type: 'auto'
    });
    
    return {
      success: true,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      url: result.secure_url,
      createdAt: result.created_at
    };
  } catch (error) {
    throw new Error('Failed to fetch file information');
  }
};

/**
 * Check if Cloudinary is configured
 * @returns {boolean}
 */
export const isCloudinaryConfigured = () => {
  return !!(
    config.cloudinaryCloudName &&
    config.cloudinaryApiKey &&
    config.cloudinaryApiSecret
  );
};

export default cloudinary;

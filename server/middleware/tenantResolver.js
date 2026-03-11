import Institution from "../models/Institution.js";
import logger from "../utils/logger.js";

/**
 * Tenant Resolution Middleware
 * Detects tenant from subdomain or x-tenant-id header
 * Attaches tenantId to req.tenant
 */
export const resolveTenant = async (req, res, next) => {
  try {
    let tenantSlug = null;
    let source = null;

    // Check for x-tenant-id header first (development)
    if (req.headers["x-tenant-id"]) {
      tenantSlug = req.headers["x-tenant-id"];
      source = "header";
    }

    // Check for subdomain in host (college.notesmitra.com)
    if (!tenantSlug && req.hostname) {
      const parts = req.hostname.split(".");
      // Get subdomain: college.notesmitra.com -> college
      if (parts.length > 2) {
        tenantSlug = parts[0];
        source = "subdomain";
      }
    }

    // If no tenant found, check if it's localhost or allowed domains (for development)
    if (!tenantSlug) {
      if (
        req.hostname === "localhost" ||
        req.hostname === "127.0.0.1" ||
        req.hostname.startsWith("localhost:") ||
        req.hostname.startsWith("127.0.0.1:")
      ) {
        // For localhost development, check if x-tenant-id is provided
        return res.status(400).json({
          success: false,
          message: "Tenant ID required in x-tenant-id header for localhost",
          code: "MISSING_TENANT",
        });
      }

      return res.status(400).json({
        success: false,
        message: "No tenant detected",
        code: "NO_TENANT_DETECTED",
      });
    }

    // Find institution by slug
    const institution = await Institution.findOne({ slug: tenantSlug });

    if (!institution) {
      logger.warn(`Tenant not found: ${tenantSlug} (source: ${source})`);
      return res.status(404).json({
        success: false,
        message: `Tenant '${tenantSlug}' not found`,
        code: "TENANT_NOT_FOUND",
      });
    }

    // Check if institution is active
    if (!institution.isActive) {
      logger.warn(`Inactive tenant attempted access: ${institution._id}`);
      return res.status(403).json({
        success: false,
        message: "Tenant account is inactive",
        code: "TENANT_INACTIVE",
      });
    }

    // Attach tenant info to request
    req.tenant = {
      id: institution._id,
      slug: institution.slug,
      name: institution.name,
      plan: institution.plan,
      maxUsers: institution.maxUsers,
      storageLimit: institution.storageLimit,
      source, // For debugging
    };

    logger.info(
      `Tenant resolved: ${institution.name} (${institution._id}) from ${source}`
    );

    next();
  } catch (error) {
    logger.error("Tenant resolution error:", error);
    return res.status(500).json({
      success: false,
      message: "Error resolving tenant",
      code: "TENANT_RESOLUTION_ERROR",
    });
  }
};

/**
 * Optional middleware to verify tenant consistency
 * Use on routes that already have tenantId in body/params
 */
export const verifyTenantConsistency = (req, res, next) => {
  const requestTenantId = req.body?.tenantId || req.params?.tenantId;

  if (requestTenantId && req.tenant.id.toString() !== requestTenantId) {
    logger.warn(
      `Tenant mismatch: request=${requestTenantId}, resolved=${req.tenant.id}`
    );
    return res.status(403).json({
      success: false,
      message: "Tenant mismatch",
      code: "TENANT_MISMATCH",
    });
  }

  next();
};

export default resolveTenant;

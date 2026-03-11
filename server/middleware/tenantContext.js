/**
 * Tenant Middleware
 * Sets tenant context for all database queries
 * Must be applied AFTER resolveTenant middleware
 */
import { setTenantContext, getTenantContext } from "../utils/tenantContext.js";
import logger from "../utils/logger.js";

export const tenantContextMiddleware = (req, res, next) => {
  if (!req.tenant) {
    logger.warn("Tenant context middleware called without req.tenant");
    return res.status(400).json({
      success: false,
      message: "Tenant context required",
    });
  }

  // Set tenant context for all async operations in this request
  setTenantContext(req.tenant.id.toString(), () => {
    next();
  });
};

/**
 * Wrapper to run database operations with tenant context
 * Use in controllers for non-middleware operations
 */
export const withTenantContext = (tenantId, operation) => {
  return new Promise((resolve, reject) => {
    setTenantContext(tenantId.toString(), async () => {
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
};

export default tenantContextMiddleware;

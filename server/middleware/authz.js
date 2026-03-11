/**
 * Tenant-Scoped Authorization Middleware
 * Provides role-based and tenant-scoped access control
 */
import { ROLES, PERMISSIONS, ROLE_HIERARCHY, hasPermission } from '../config/roles.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * Protect route - verify user is authenticated
 * Must be used with tenantResolver middleware
 */
export const protect = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
        code: 'UNAUTHORIZED'
      });
    }

    if (!req.tenant) {
      return res.status(400).json({
        success: false,
        message: 'Tenant context required',
        code: 'NO_TENANT'
      });
    }

    // Verify user belongs to current tenant
    if (req.user.tenantId.toString() !== req.tenant.id.toString()) {
      logger.warn(`Cross-tenant access attempt: user=${req.user._id}, tenant=${req.tenant.id}`);
      return res.status(403).json({
        success: false,
        message: 'Access denied - tenant mismatch',
        code: 'TENANT_MISMATCH'
      });
    }

    next();
  } catch (error) {
    logger.error('Auth protection error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Check if user is superadmin (platform owner)
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  if (!req.user.isSuperAdmin) {
    logger.warn(`Superadmin access denied for user: ${req.user._id}`);
    return res.status(403).json({
      success: false,
      message: 'Only superadmins can access this resource',
      code: 'SUPERADMIN_ONLY'
    });
  }

  next();
};

/**
 * Check if user is tenant admin
 */
export const requireTenantAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  if (!req.tenant) {
    return res.status(400).json({
      success: false,
      message: 'Tenant context required',
      code: 'NO_TENANT'
    });
  }

  // Superadmin can act as tenant admin
  if (!req.user.isSuperAdmin && !req.user.isTenantAdmin) {
    logger.warn(`Tenant admin access denied for user: ${req.user._id} in tenant: ${req.tenant.id}`);
    return res.status(403).json({
      success: false,
      message: 'Only tenant admins can access this resource',
      code: 'TENANT_ADMIN_ONLY'
    });
  }

  next();
};

/**
 * Check if user has specific role within tenant
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const userRole = req.user.role;

    // Superadmin can do anything
    if (req.user.isSuperAdmin) {
      return next();
    }

    // Tenant admin can act as any role within tenant
    if (req.user.isTenantAdmin) {
      return next();
    }

    if (!allowedRoles.includes(userRole)) {
      logger.warn(
        `Role denied for user: ${req.user._id}, required: ${allowedRoles}, has: ${userRole}`
      );
      return res.status(403).json({
        success: false,
        message: `Only users with roles: ${allowedRoles.join(', ')} can access this resource`,
        code: 'ROLE_DENIED'
      });
    }

    next();
  };
};

/**
 * Check if user has specific permission
 * Supports wildcard permissions (e.g., 'manage:*')
 */
export const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    const userRole = req.user.role;
    let hasAccess = false;

    // Superadmin has all permissions
    if (req.user.isSuperAdmin) {
      hasAccess = true;
    }
    // Tenant admin has all tenant permissions
    else if (req.user.isTenantAdmin && requiredPermission.startsWith('manage:tenant:')) {
      hasAccess = true;
    }
    // Check role-based permissions
    else {
      const userPermissions = PERMISSIONS[userRole] || [];

      // Check exact permission
      if (userPermissions.includes(requiredPermission)) {
        hasAccess = true;
      }

      // Check wildcard permissions
      const [resource, action] = requiredPermission.split(':');
      if (userPermissions.includes(`${action}:${resource}:*`)) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      logger.warn(
        `Permission denied for user: ${req.user._id}, required: ${requiredPermission}, role: ${userRole}`
      );
      return res.status(403).json({
        success: false,
        message: `Permission denied: ${requiredPermission}`,
        code: 'PERMISSION_DENIED'
      });
    }

    next();
  };
};

/**
 * Verify user owns resource or is admin
 * Checks if resource belongs to user's tenant and (is owned by user OR user is tenant admin)
 */
export const verifyResourceOwnership = (resourceField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    if (!req.body && !req.params) {
      return res.status(400).json({
        success: false,
        message: 'No resource data',
        code: 'NO_RESOURCE'
      });
    }

    const resourceOwnerId = req.body[resourceField] || req.params[resourceField];
    const userId = req.user._id.toString();
    const isOwner = resourceOwnerId === userId || resourceOwnerId.toString() === userId;
    const isAdmin = req.user.isSuperAdmin || req.user.isTenantAdmin;

    if (!isOwner && !isAdmin) {
      logger.warn(
        `Resource ownership denied: user=${userId}, resource=${resourceOwnerId}`
      );
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource',
        code: 'OWNERSHIP_DENIED'
      });
    }

    next();
  };
};

/**
 * Check user role hierarchy
 * Allows users with higher roles to perform lower role actions
 */
export const requireMinimumRole = (minimumRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }

    // Superadmin always passes
    if (req.user.isSuperAdmin) {
      return next();
    }

    // Tenant admin always passes for tenant operations
    if (req.user.isTenantAdmin) {
      return next();
    }

    const userRoleLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const minimumRoleLevel = ROLE_HIERARCHY[minimumRole] || 0;

    if (userRoleLevel < minimumRoleLevel) {
      logger.warn(
        `Insufficient role: user=${req.user._id}, has=${req.user.role}(${userRoleLevel}), need=${minimumRole}(${minimumRoleLevel})`
      );
      return res.status(403).json({
        success: false,
        message: `Minimum role required: ${minimumRole}`,
        code: 'INSUFFICIENT_ROLE'
      });
    }

    next();
  };
};

export default {
  protect,
  requireSuperAdmin,
  requireTenantAdmin,
  requireRole,
  requirePermission,
  verifyResourceOwnership,
  requireMinimumRole
};

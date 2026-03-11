/**
 * Role and Permission Constants
 * Supports both platform-wide roles and tenant-scoped roles
 */

export const ROLES = {
  // Global roles
  SUPERADMIN: 'superadmin',    // Platform owner
  ADMIN: 'admin',              // Global admin
  SELLER: 'seller',            // Seller role
  BUYER: 'buyer',              // Buyer/Student role
  TEACHER: 'teacher',          // Teacher role
  STUDENT: 'student'           // Student role
};

export const TENANT_ROLES = {
  ADMIN: 'admin',              // Tenant admin
  SELLER: 'seller',            // Seller within tenant
  BUYER: 'buyer',              // Buyer within tenant
  TEACHER: 'teacher',          // Teacher within tenant
  STUDENT: 'student'           // Student within tenant
};

/**
 * Role Hierarchy and Permissions
 * Higher level roles inherit lower level permissions
 */
export const ROLE_HIERARCHY = {
  superadmin: 10,   // Full platform access
  admin: 8,         // Tenant admin
  teacher: 6,       // Can manage content
  seller: 5,        // Can sell notes
  buyer: 3,         // Can buy notes
  student: 1        // Basic access
};

/**
 * Permission Matrix by Role
 * Defines what each role can do within a tenant
 */
export const PERMISSIONS = {
  // Superadmin - Full access
  superadmin: [
    'manage:institutions',
    'manage:users',
    'manage:all:content',
    'manage:payments',
    'view:analytics',
    'manage:admins'
  ],

  // Tenant Admin - Full tenant access
  admin: [
    'manage:tenant:users',
    'manage:tenant:content',
    'view:tenant:analytics',
    'manage:tenant:settings',
    'moderate:content',
    'manage:tickets'
  ],

  // Teacher - Content management
  teacher: [
    'create:content',
    'edit:own:content',
    'view:own:analytics',
    'manage:own:resources'
  ],

  // Seller - Can sell notes
  seller: [
    'create:notes',
    'edit:own:notes',
    'upload:files',
    'view:own:earnings',
    'manage:own:notes'
  ],

  // Buyer - Can purchase
  buyer: [
    'view:notes',
    'purchase:notes',
    'download:purchased',
    'rate:content',
    'create:tickets',
    'manage:own:wallet'
  ],

  // Student - Basic access
  student: [
    'view:notes',
    'create:tickets'
  ]
};

/**
 * Check if user has permission
 */
export const hasPermission = (userRole, permission) => {
  const rolePermissions = PERMISSIONS[userRole] || [];
  return rolePermissions.includes(permission);
};

/**
 * Check if user can perform action on resource
 */
export const canAccess = (userRole, requiredPermission) => {
  return hasPermission(userRole, requiredPermission);
};

/**
 * Get all permissions for a role
 */
export const getRolePermissions = (role) => {
  return PERMISSIONS[role] || [];
};

export default {
  ROLES,
  TENANT_ROLES,
  ROLE_HIERARCHY,
  PERMISSIONS,
  hasPermission,
  canAccess,
  getRolePermissions
};

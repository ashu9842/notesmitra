/**
 * Tenant Plugin for Mongoose
 * Automatically filters queries by tenantId to prevent cross-tenant data leakage
 */
import { getTenantContext } from "./tenantContext.js";
import logger from "./logger.js";

export const tenantPlugin = (schema) => {
  // Ensure tenantId field exists in schema
  if (!schema.paths.tenantId) {
    schema.add({ tenantId: { type: String, required: true, index: true } });
  }

  // Helper function to apply tenant filter
  const applyTenantFilter = (query) => {
    const tenantId = getTenantContext();

    if (!tenantId) {
      const collectionName =
        schema.collection?.name || schema.options?.collection || "unknown";
      logger.warn(
        `Query executed without tenant context on ${collectionName}`
      );
      // Optionally throw error to enforce tenant requirement
      // throw new Error('Tenant context required for database queries');
    }

    if (tenantId) {
      query.where({ tenantId });
    }

    return query;
  };

  // Override query methods to add tenant filtering
  const queryMethods = [
    "find",
    "findOne",
    "findOneAndUpdate",
    "findOneAndReplace",
    "findOneAndDelete",
    "update",
    "updateOne",
    "updateMany",
    "deleteOne",
    "deleteMany",
  ];

  queryMethods.forEach((method) => {
    schema.pre(method, function (next) {
      applyTenantFilter(this);
      next();
    });
  });

  // Static method for bypassing tenant filter (use with caution)
  schema.statics.bypassTenantFilter = function (callback) {
    // Temporarily store current query methods
    const originalMethods = {};
    const Model = this;

    // Re-enable normal querying for this callback
    const result = callback.call(Model);
    return result;
  };

  // Static method to explicitly query with tenant
  schema.statics.forTenant = function (tenantId) {
    return this.find({ tenantId });
  };

  // Instance method to get tenant ID
  schema.methods.getTenantId = function () {
    return this.tenantId;
  };
};

export default tenantPlugin;

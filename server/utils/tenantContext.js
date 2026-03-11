/**
 * Tenant Context Manager
 * Uses AsyncLocalStorage to track current tenant across async operations
 */
import { AsyncLocalStorage } from "async_hooks";

const tenantStore = new AsyncLocalStorage();

export const setTenantContext = (tenantId, callback) => {
  return tenantStore.run(tenantId, callback);
};

export const getTenantContext = () => {
  return tenantStore.getStore();
};

export const withTenantContext = (tenantId) => {
  return (req, res, next) => {
    tenantStore.run(tenantId, () => {
      next();
    });
  };
};

export default {
  setTenantContext,
  getTenantContext,
  withTenantContext,
};

import express from 'express';
import {
  getAllTenants,
  getTenantDetails,
  suspendTenant,
  upgradeTenantPlan,
  getRevenueAnalytics,
  getTenantRevenue
} from '../controllers/superadminController.js';
import { protect, requireSuperAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require superadmin authorization
router.use(protect);
router.use(requireSuperAdmin);

// Tenant management routes
router.get('/tenants', getAllTenants);
router.get('/tenants/:tenantId', getTenantDetails);
router.put('/tenants/:tenantId/suspend', suspendTenant);
router.put('/tenants/:tenantId/upgrade-plan', upgradeTenantPlan);

// Revenue analytics routes
router.get('/revenue', getRevenueAnalytics);
router.get('/tenants/:tenantId/revenue', getTenantRevenue);

export default router;

import Institution from '../models/Institution.js';
import Subscription from '../models/Subscription.js';
import Purchase from '../models/Purchase.js';
import User from '../models/User.js';
import * as cache from '../utils/cache.js';
import logger from '../utils/logger.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @desc    Get all tenants with statistics
 * @route   GET /api/superadmin/tenants
 * @access  Private (Superadmin)
 */
export const getAllTenants = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', sortBy = 'createdAt', order = 'desc' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * pageSize;

    // Build search filter
    const filter = {};
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { slug: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    // Build sort object
    const sortObj = {};
    const validSortFields = ['name', 'plan', 'createdAt', 'isActive', 'subscriptionStatus'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortOrder = order === 'asc' ? 1 : -1;
    sortObj[sortField] = sortOrder;

    // Get tenants with pagination
    const [tenants, total] = await Promise.all([
      Institution.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(pageSize)
        .select('name slug plan subscriptionStatus isActive usedStorage storageLimit currentUploads maxUploads createdAt updatedAt subscriptionExpiry')
        .lean(),
      Institution.countDocuments(filter)
    ]);

    // Get subscription and revenue data for each tenant
    const tenantsWithData = await Promise.all(
      tenants.map(async (tenant) => {
        const [subscription, users, totalRevenue] = await Promise.all([
          Subscription.findOne({ tenantId: tenant._id })
            .select('plan status expiryDate price billingCycle')
            .lean(),
          User.countDocuments({ tenantId: tenant._id, isActive: true }),
          Purchase.aggregate([
            {
              $match: {
                createdAt: { $exists: true },
                status: 'completed'
              }
            },
            {
              $lookup: {
                from: 'notes',
                localField: 'noteId',
                foreignField: '_id',
                as: 'note'
              }
            },
            {
              $unwind: '$note'
            },
            {
              $match: {
                'note.tenantId': tenant._id
              }
            },
            {
              $group: {
                _id: null,
                revenue: { $sum: '$platformFee' }
              }
            }
          ])
        ]);

        return {
          ...tenant,
          activeUsers: users,
          subscription: subscription || null,
          monthlyRevenue: totalRevenue[0]?.revenue || 0
        };
      })
    );

    logger.info('Superadmin fetched all tenants', {
      userId: req.user._id,
      count: tenantsWithData.length,
      total
    });

    res.status(200).json({
      success: true,
      data: tenantsWithData,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    logger.error('Error fetching tenants in superadmin', {
      userId: req.user._id,
      error: error.message
    });
    next(error);
  }
};

/**
 * @desc    Get tenant details with full statistics
 * @route   GET /api/superadmin/tenants/:tenantId
 * @access  Private (Superadmin)
 */
export const getTenantDetails = async (req, res, next) => {
  try {
    const { tenantId } = req.params;

    const tenant = await Institution.findById(tenantId)
      .select('name slug plan subscriptionStatus isActive walletBalance usedStorage storageLimit currentUploads maxUploads createdAt updatedAt subscriptionExpiry');

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Get subscription details
    const subscription = await Subscription.findOne({ tenantId })
      .select('plan status startDate expiryDate price billingCycle autoRenew features');

    // Get user statistics
    const userStats = await User.aggregate([
      { $match: { tenantId: tenant._id } },
      {
        $facet: {
          total: [{ $count: 'count' }],
          active: [{ $match: { isActive: true } }, { $count: 'count' }],
          roleBreakdown: [
            { $group: { _id: '$role', count: { $sum: 1 } } }
          ]
        }
      }
    ]);

    // Get revenue data
    const revenueData = await Purchase.aggregate([
      {
        $lookup: {
          from: 'notes',
          localField: 'noteId',
          foreignField: '_id',
          as: 'note'
        }
      },
      {
        $unwind: '$note'
      },
      {
        $match: {
          'note.tenantId': tenant._id,
          status: 'completed'
        }
      },
      {
        $facet: {
          total: [{ $count: 'count' }],
          revenue: [
            { $group: { _id: null, total: { $sum: '$platformFee' } } }
          ],
          monthlyRevenue: [
            {
              $group: {
                _id: { $month: '$createdAt' },
                revenue: { $sum: '$platformFee' }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);

    // Get note statistics
    const noteStats = await Note.countDocuments({ tenantId });
    const activeNotes = await Note.countDocuments({ tenantId, status: 'approved' });

    logger.info('Superadmin fetched tenant details', {
      userId: req.user._id,
      tenantId
    });

    res.status(200).json({
      success: true,
      data: {
        tenant,
        subscription,
        users: userStats[0],
        revenue: {
          purchases: revenueData[0].total[0]?.count || 0,
          totalRevenue: revenueData[0].revenue[0]?.total || 0,
          monthlyBreakdown: revenueData[0].monthlyRevenue
        },
        notes: {
          total: noteStats,
          active: activeNotes
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching tenant details in superadmin', {
      userId: req.user._id,
      tenantId: req.params.tenantId,
      error: error.message
    });
    next(error);
  }
};

/**
 * @desc    Suspend/Unsuspend a tenant
 * @route   PUT /api/superadmin/tenants/:tenantId/suspend
 * @access  Private (Superadmin)
 * @body    { isSuspended: boolean, reason?: string }
 */
export const suspendTenant = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const { suspend = true, reason = '' } = req.body;

    const tenant = await Institution.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Update subscription status
    const subscription = await Subscription.findOne({ tenantId });
    if (subscription) {
      subscription.status = suspend ? 'suspended' : 'active';
      subscription.suspensionReason = reason;
      subscription.suspendedAt = suspend ? new Date() : null;
      await subscription.save();
    }

    // Update institution status if suspend
    if (suspend) {
      tenant.isActive = false;
    } else {
      tenant.isActive = true;
    }
    
    await tenant.save();

    // Clear cache
    await cache.deletePattern(`institution:${tenantId}:*`);
    await cache.deletePattern('admin:stats');

    logger.info('Superadmin suspended/unsuspended tenant', {
      userId: req.user._id,
      tenantId,
      action: suspend ? 'suspended' : 'unsuspended',
      reason
    });

    res.status(200).json({
      success: true,
      message: suspend ? 'Tenant suspended successfully' : 'Tenant unsuspended successfully',
      data: {
        tenantId,
        isActive: !suspend,
        subscriptionStatus: subscription?.status
      }
    });
  } catch (error) {
    logger.error('Error suspending tenant in superadmin', {
      userId: req.user._id,
      tenantId: req.params.tenantId,
      error: error.message
    });
    next(error);
  }
};

/**
 * @desc    Upgrade tenant plan
 * @route   PUT /api/superadmin/tenants/:tenantId/upgrade-plan
 * @access  Private (Superadmin)
 * @body    { newPlan: 'free'|'pro'|'enterprise', billingCycle: 'monthly'|'quarterly'|'yearly' }
 */
export const upgradeTenantPlan = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const { newPlan, billingCycle = 'monthly' } = req.body;

    if (!['free', 'pro', 'enterprise'].includes(newPlan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan. Must be one of: free, pro, enterprise'
      });
    }

    const tenant = await Institution.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Plan configurations
    const planConfigs = {
      free: {
        maxUsers: 10,
        maxUploads: 50,
        storageLimit: 10, // GB
        price: 0,
        features: {
          customBranding: false,
          advancedAnalytics: false,
          prioritySupport: false,
          apiAccess: false,
          sso: false,
          dataResidency: false
        }
      },
      pro: {
        maxUsers: 100,
        maxUploads: 1000,
        storageLimit: 500, // GB
        price: 99,
        features: {
          customBranding: true,
          advancedAnalytics: true,
          prioritySupport: false,
          apiAccess: false,
          sso: false,
          dataResidency: false
        }
      },
      enterprise: {
        maxUsers: 1000,
        maxUploads: 10000,
        storageLimit: 5000, // GB
        price: 999,
        features: {
          customBranding: true,
          advancedAnalytics: true,
          prioritySupport: true,
          apiAccess: true,
          sso: true,
          dataResidency: true
        }
      }
    };

    const config = planConfigs[newPlan];

    // Update institution plan
    tenant.plan = newPlan;
    tenant.maxUsers = config.maxUsers;
    tenant.maxUploads = config.maxUploads;
    tenant.storageLimit = config.storageLimit;
    await tenant.save();

    // Update or create subscription
    let subscription = await Subscription.findOne({ tenantId });
    
    const today = new Date();
    const expiryDate = new Date();
    
    // Set expiry based on billing cycle
    if (billingCycle === 'monthly') {
      expiryDate.setMonth(expiryDate.getMonth() + 1);
    } else if (billingCycle === 'quarterly') {
      expiryDate.setMonth(expiryDate.getMonth() + 3);
    } else if (billingCycle === 'yearly') {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    }

    if (subscription) {
      subscription.plan = newPlan;
      subscription.status = 'active';
      subscription.startDate = today;
      subscription.expiryDate = expiryDate;
      subscription.billingCycle = billingCycle;
      subscription.price = config.price;
      subscription.features = config.features;
      await subscription.save();
    } else {
      subscription = await Subscription.create({
        tenantId,
        plan: newPlan,
        status: 'active',
        startDate: today,
        expiryDate,
        billingCycle,
        price: config.price,
        features: config.features,
        autoRenew: true,
        paymentMethod: 'admin_upgrade'
      });
    }

    // Clear cache
    await cache.deletePattern(`institution:${tenantId}:*`);
    await cache.deletePattern('admin:stats');

    logger.info('Superadmin upgraded tenant plan', {
      userId: req.user._id,
      tenantId,
      oldPlan: tenant.plan,
      newPlan,
      billingCycle
    });

    res.status(200).json({
      success: true,
      message: `Tenant plan upgraded to ${newPlan}`,
      data: {
        tenantId,
        plan: newPlan,
        limits: {
          maxUsers: config.maxUsers,
          maxUploads: config.maxUploads,
          storageLimit: config.storageLimit
        },
        subscription: {
          status: subscription.status,
          startDate: subscription.startDate,
          expiryDate: subscription.expiryDate,
          billingCycle
        }
      }
    });
  } catch (error) {
    logger.error('Error upgrading tenant plan in superadmin', {
      userId: req.user._id,
      tenantId: req.params.tenantId,
      error: error.message
    });
    next(error);
  }
};

/**
 * @desc    Get revenue analytics for all tenants
 * @route   GET /api/superadmin/revenue
 * @access  Private (Superadmin)
 */
export const getRevenueAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = 'tenant' } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // If no dates provided, use last 30 days
    if (!startDate && !endDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter.$gte = thirtyDaysAgo;
    }

    const matchStage = {
      status: 'completed',
      ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
    };

    let revenueData;

    if (groupBy === 'date') {
      // Revenue grouped by date
      revenueData = await Purchase.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            revenue: { $sum: '$platformFee' },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]);
    } else if (groupBy === 'plan') {
      // Revenue grouped by tenant plan
      revenueData = await Purchase.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: 'notes',
            localField: 'noteId',
            foreignField: '_id',
            as: 'note'
          }
        },
        { $unwind: '$note' },
        {
          $lookup: {
            from: 'institutions',
            localField: 'note.tenantId',
            foreignField: '_id',
            as: 'institution'
          }
        },
        { $unwind: '$institution' },
        {
          $group: {
            _id: '$institution.plan',
            revenue: { $sum: '$platformFee' },
            count: { $sum: 1 },
            tenants: { $addToSet: '$note.tenantId' }
          }
        },
        {
          $project: {
            _id: 1,
            revenue: 1,
            count: 1,
            uniqueTenants: { $size: '$tenants' }
          }
        }
      ]);
    } else {
      // Revenue grouped by tenant (default)
      revenueData = await Purchase.aggregate([
        { $match: matchStage },
        {
          $lookup: {
            from: 'notes',
            localField: 'noteId',
            foreignField: '_id',
            as: 'note'
          }
        },
        { $unwind: '$note' },
        {
          $lookup: {
            from: 'institutions',
            localField: 'note.tenantId',
            foreignField: '_id',
            as: 'institution'
          }
        },
        { $unwind: '$institution' },
        {
          $group: {
            _id: '$institution._id',
            institutionName: { $first: '$institution.name' },
            plan: { $first: '$institution.plan' },
            revenue: { $sum: '$platformFee' },
            transactionCount: { $sum: 1 }
          }
        },
        { $sort: { revenue: -1 } }
      ]);
    }

    // Calculate totals
    const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);
    const totalTransactions = revenueData.reduce((sum, item) => sum + item.count, 0);

    logger.info('Superadmin fetched revenue analytics', {
      userId: req.user._id,
      groupBy,
      dataPoints: revenueData.length
    });

    res.status(200).json({
      success: true,
      data: {
        analytics: revenueData,
        summary: {
          totalRevenue,
          totalTransactions,
          averagePerTransaction: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
          dataPoints: revenueData.length
        },
        period: {
          startDate: startDate || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
          endDate: endDate || new Date().toISOString().split('T')[0]
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching revenue analytics in superadmin', {
      userId: req.user._id,
      error: error.message
    });
    next(error);
  }
};

/**
 * @desc    Get revenue per specific tenant
 * @route   GET /api/superadmin/tenants/:tenantId/revenue
 * @access  Private (Superadmin)
 */
export const getTenantRevenue = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify tenant exists
    const tenant = await Institution.findById(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // Get revenue data for this tenant
    const revenueData = await Purchase.aggregate([
      {
        $lookup: {
          from: 'notes',
          localField: 'noteId',
          foreignField: '_id',
          as: 'note'
        }
      },
      { $unwind: '$note' },
      {
        $match: {
          'note.tenantId': tenant._id,
          status: 'completed',
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
        }
      },
      {
        $facet: {
          total: [{ $count: 'count' }],
          revenue: [
            { $group: { _id: null, total: { $sum: '$platformFee' } } }
          ],
          dailyBreakdown: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                },
                revenue: { $sum: '$platformFee' },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ],
          topNotes: [
            { $sort: { 'platformFee': -1, createdAt: -1 } },
            { $limit: 10 },
            {
              $project: {
                _id: 1,
                'note.title': 1,
                'note._id': 1,
                platformFee: 1,
                createdAt: 1
              }
            }
          ]
        }
      }
    ]);

    logger.info('Superadmin fetched tenant revenue', {
      userId: req.user._id,
      tenantId
    });

    res.status(200).json({
      success: true,
      data: {
        tenant: {
          id: tenant._id,
          name: tenant.name,
          plan: tenant.plan
        },
        revenue: {
          totalTransactions: revenueData[0].total[0]?.count || 0,
          totalRevenue: revenueData[0].revenue[0]?.total || 0,
          dailyBreakdown: revenueData[0].dailyBreakdown,
          topPerformingNotes: revenueData[0].topNotes
        },
        period: {
          startDate: startDate || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
          endDate: endDate || new Date().toISOString().split('T')[0]
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching tenant revenue in superadmin', {
      userId: req.user._id,
      tenantId: req.params.tenantId,
      error: error.message
    });
    next(error);
  }
};

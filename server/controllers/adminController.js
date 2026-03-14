import User from '../models/User.js';
import Note from '../models/Note.js';
import Purchase from '../models/Purchase.js';
import Ticket from '../models/Ticket.js';
import Wallet from '../models/Wallet.js';
import config from '../config/index.js';
import { emitAdminStatsUpdate } from '../services/paymentService.js';
import * as cache from '../utils/cache.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc    Get platform statistics
// @route   GET /api/admin/stats
// @access  Private (Admin)
export const getStats = async (req, res, next) => {
  try {
    const cacheKey = 'admin:stats';

    // Check cache first
    const cachedStats = await cache.get(cacheKey);
    if (cachedStats) {
      return res.status(200).json(cachedStats);
    }

    // Run optimized aggregation pipelines in parallel
    const [userStats, noteStats, purchaseStats, ticketStats] = await Promise.all([
      // User statistics with role counts
      User.aggregate([
        {
          $facet: {
            totalUsers: [{ $count: 'count' }],
            roleBreakdown: [
              { $group: { _id: '$role', count: { $sum: 1 } } }
            ]
          }
        }
      ]).option('maxTimeMS', 15000),

      // Note statistics with status counts and recent notes
      Note.aggregate([
        {
          $facet: {
            totalNotes: [{ $count: 'count' }],
            statusBreakdown: [
              { $group: { _id: '$status', count: { $sum: 1 } } }
            ],
            recentNotes: [
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              {
                $lookup: {
                  from: 'users',
                  localField: 'sellerId',
                  foreignField: '_id',
                  as: 'sellerId'
                }
              },
              { $unwind: '$sellerId' },
              {
                $project: {
                  title: 1,
                  status: 1,
                  createdAt: 1,
                  'sellerId._id': 1,
                  'sellerId.name': 1,
                  'sellerId.email': 1
                }
              }
            ]
          }
        }
      ]).option('maxTimeMS', 15000),

      // Purchase statistics with revenue and recent purchases
      Purchase.aggregate([
        {
          $facet: {
            totalPurchases: [
              { $match: { status: 'completed' } },
              { $count: 'count' }
            ],
            totalRevenue: [
              { $match: { status: 'completed' } },
              { $group: { _id: null, revenue: { $sum: '$platformFee' } } }
            ],
            recentPurchases: [
              { $match: { status: 'completed' } },
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              {
                $lookup: {
                  from: 'notes',
                  localField: 'noteId',
                  foreignField: '_id',
                  as: 'noteId'
                }
              },
              { $unwind: '$noteId' },
              {
                $lookup: {
                  from: 'users',
                  localField: 'buyerId',
                  foreignField: '_id',
                  as: 'buyerId'
                }
              },
              { $unwind: '$buyerId' },
              {
                $lookup: {
                  from: 'users',
                  localField: 'sellerId',
                  foreignField: '_id',
                  as: 'sellerId'
                }
              },
              { $unwind: '$sellerId' },
              {
                $project: {
                  amount: 1,
                  platformFee: 1,
                  sellerEarnings: 1,
                  createdAt: 1,
                  'noteId._id': 1,
                  'noteId.title': 1,
                  'buyerId._id': 1,
                  'buyerId.name': 1,
                  'sellerId._id': 1,
                  'sellerId.name': 1
                }
              }
            ]
          }
        }
      ]).option('maxTimeMS', 15000),

      // Ticket statistics with status counts
      Ticket.aggregate([
        {
          $facet: {
            totalTickets: [{ $count: 'count' }],
            statusBreakdown: [
              { $group: { _id: '$status', count: { $sum: 1 } } }
            ]
          }
        }
      ]).option('maxTimeMS', 15000)
    ]);

    // Extract and format results
    const totalUsers = userStats[0].totalUsers[0]?.count || 0;
    const roleBreakdown = userStats[0].roleBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    const totalSellers = roleBreakdown.seller || 0;
    const totalBuyers = roleBreakdown.buyer || 0;
    const totalAdmins = roleBreakdown.admin || 0;

    const totalNotes = noteStats[0].totalNotes[0]?.count || 0;
    const noteStatusBreakdown = noteStats[0].statusBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    const pendingReview = noteStatusBreakdown.pending_review || 0;
    const approvedNotes = noteStatusBreakdown.approved || 0;
    const rejectedNotes = noteStatusBreakdown.rejected || 0;
    const recentNotes = noteStats[0].recentNotes;

    const totalPurchases = purchaseStats[0].totalPurchases[0]?.count || 0;
    const totalRevenue = purchaseStats[0].totalRevenue[0]?.revenue || 0;
    const recentPurchases = purchaseStats[0].recentPurchases;

    // Get actual platform wallet balance and full transaction history
    let platformWalletBalance = 0;
    let platformWalletTransactions = [];
    let platformTotalEarnings = Number(totalRevenue || 0);
    if (config.platformUserId) {
      const platformWallet = await Wallet.findOne({ userId: config.platformUserId }).select('balance transactions').lean();
      platformWalletBalance = platformWallet?.balance || 0;

      // Resolve user IDs in subscription descriptions -> names
      const rawTxns = platformWallet?.transactions || [];
      platformTotalEarnings = rawTxns.reduce((sum, txn) => {
        const isCompletedCredit = txn.type === 'credit' && (txn.status || 'completed') === 'completed';
        return isCompletedCredit ? sum + Number(txn.amount || 0) : sum;
      }, 0);

      const userIdRegex = /User:\s*([a-f0-9]{24})/gi;
      const userIdSet = new Set();
      for (const t of rawTxns) {
        let m;
        while ((m = userIdRegex.exec(t.description || '')) !== null) userIdSet.add(m[1]);
        userIdRegex.lastIndex = 0;
      }
      const userMap = {};
      if (userIdSet.size > 0) {
        const users = await User.find({ _id: { $in: [...userIdSet] } }).select('name email').lean();
        for (const u of users) userMap[u._id.toString()] = u.name || u.email || u._id.toString();
      }

      const planLabels = { premium_buyer: 'Premium Buyer', premium_seller: 'Premium Seller', combo: 'Combo', free_buyer: 'Free Buyer', free_seller: 'Free Seller' };

      platformWalletTransactions = rawTxns.map(t => {
        let desc = (t.description || '')
          .replace(/^\[Backfill\]\s*/i, '')
          .replace(/\bPremium subscription revenue:\s*(\w+)/gi, (_, plan) =>
            `Premium Subscription — ${planLabels[plan] || plan} Plan`)
          .replace(/\bsub_rev_backfill_[a-f0-9]+/gi, '')
          .replace(/\(User:\s*([a-f0-9]{24})[^)]*\)/gi, (_, uid) => {
            const name = userMap[uid];
            return name ? `(${name})` : '';
          })
          .replace(/,\s*Sub:\s*[a-f0-9]{24}/gi, '')
          .replace(/,?\s*Status:\s*\w+/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
        return { id: t.id, type: t.type, amount: t.amount, description: desc, status: t.status, timestamp: t.timestamp };
      });
    }

    const totalTickets = ticketStats[0].totalTickets[0]?.count || 0;
    const ticketStatusBreakdown = ticketStats[0].statusBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    const openTickets = ticketStatusBreakdown.open || 0;

    const response = {
      success: true,
      stats: {
        totalNotes,
        pendingReview,
        approvedNotes,
        rejectedNotes,
        totalUsers,
        totalSellers,
        totalBuyers,
        totalAdmins,
        totalPurchases,
        totalRevenue: totalRevenue.toFixed(2),
        platformWalletBalance: platformWalletBalance.toFixed(2),
        platformTotalEarnings: Number(platformTotalEarnings || 0).toFixed(2),
        platformWalletTransactions,
        openTickets,
        totalTickets,
        recentNotes,
        recentPurchases
      }
    };

    // Cache for 60 seconds
    await cache.set(cacheKey, response, 60);

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin)
export const getAllUsers = async (req, res, next) => {
  try {
    const { role, search } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    let query = {};
    if (role) query.role = role;
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    const totalCount = await User.countDocuments(query).maxTimeMS(5000);

    const users = await User.find(query)
      .select('name email role isActive walletBalance totalEarnings createdAt updatedAt isPremiumBuyer isPremiumSeller subscriptionType subscriptionExpiry')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .maxTimeMS(5000)
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      page,
      limit,
      users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user status
// @route   PUT /api/admin/users/:id
// @access  Private (Admin)
export const updateUserStatus = async (req, res, next) => {
  try {
    const { isActive, role } = req.body;

    const updateFields = {};
    if (typeof isActive !== 'undefined') updateFields.isActive = isActive;
    if (role) {
      // Prevent privilege escalation — admins cannot grant admin/superadmin roles
      const allowedRoles = ['buyer', 'seller', 'student', 'teacher'];
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          error: 'Cannot assign elevated roles through this endpoint'
        });
      }
      updateFields.role = role;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Emit admin stats update
    emitAdminStatsUpdate();

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Don't allow deleting yourself
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'You cannot delete your own account'
      });
    }

    await user.deleteOne();

    // Emit admin stats update
    emitAdminStatsUpdate();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

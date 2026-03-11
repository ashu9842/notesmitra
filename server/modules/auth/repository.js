import User from '../../models/User.js';
import Wallet from '../../models/Wallet.js';
import RefreshToken from '../../models/RefreshToken.js';
import Institution from '../../models/Institution.js';
import Subscription from '../../models/Subscription.js';

export class AuthRepository {
  async findUserByGoogleId(googleId) {
    return User.findOne({ googleId });
  }

  async findUserByResetToken(hashedToken) {
    return User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    }).select('+resetPasswordToken +resetPasswordExpires +password');
  }

  async findUserByVerificationToken(hashedToken) {
    return User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() }
    }).select('+emailVerificationToken +emailVerificationExpires');
  }

  async findUserByEmail(email, { includePassword = false, tenantId = null } = {}) {
    const query = User.findOne({ email });
    if (tenantId) {
      query.where({ tenantId });
    }
    return includePassword ? query.select('+password') : query;
  }

  async findUserById(userId, { includePassword = false } = {}) {
    const query = User.findById(userId);
    return includePassword ? query.select('+password') : query;
  }

  async createUser({ name, email, password, role, tenantId, isTenantAdmin = false }) {
    return User.create({
      name,
      email,
      password,
      role,
      tenantId,
      isTenantAdmin
    });
  }

  async updateUserById(userId, update, options = {}) {
    return User.findByIdAndUpdate(userId, update, options);
  }

  async createWalletForUser({ userId, tenantId, balance = 0, transactions = [] }) {
    return Wallet.create({
      userId,
      tenantId,
      balance,
      transactions
    });
  }

  async countUsersByTenant(tenantId) {
    return User.countDocuments({ tenantId });
  }

  // Tenant operations
  async findInstitutionById(institutionId) {
    return Institution.findById(institutionId);
  }

  async findInstitutionBySlug(slug) {
    return Institution.findOne({ slug });
  }

  async createInstitution({ name, slug, plan = 'free', maxUsers = 10, storageLimit = 10 }) {
    return Institution.create({
      name,
      slug,
      plan,
      maxUsers,
      storageLimit,
      isActive: true
    });
  }

  async updateInstitution(institutionId, update, options = {}) {
    return Institution.findByIdAndUpdate(institutionId, update, {
      new: true,
      runValidators: true,
      ...options
    });
  }

  // Refresh token operations
  async createRefreshToken({ userId, token, expiresAt }) {
    return RefreshToken.create({ userId, token, expiresAt });
  }

  async findRefreshTokenByToken(token) {
    return RefreshToken.findOne({ token });
  }

  async deleteRefreshTokenById(refreshTokenId) {
    return RefreshToken.deleteOne({ _id: refreshTokenId });
  }

  async deleteRefreshTokenByToken(token) {
    return RefreshToken.deleteOne({ token });
  }

  // Subscription operations
  async findSubscriptionByTenant(tenantId) {
    return Subscription.findOne({ tenantId });
  }

  async createSubscription(subscriptionData) {
    return Subscription.create(subscriptionData);
  }

  async updateSubscription(subscriptionId, update, options = {}) {
    return Subscription.findByIdAndUpdate(subscriptionId, update, {
      new: true,
      runValidators: true,
      ...options
    });
  }

  async getExpiringSubscriptions(daysUntil = 7) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysUntil * 24 * 60 * 60 * 1000);

    return Subscription.find({
      status: 'active',
      expiryDate: {
        $gte: now,
        $lte: futureDate
      }
    });
  }
}

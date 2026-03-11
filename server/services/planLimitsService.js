/**
 * Plan Limits Enforcement Service
 * Checks and validates plan limits before operations
 */
import { getPlanLimits } from '../config/planLimits.js';
import AppError from '../utils/AppError.js';
import logger from '../utils/logger.js';

export class PlanLimitsService {
  constructor(repository) {
    this.repository = repository;
  }

  /**
   * Check if tenant can add new user
   */
  async canAddUser(tenantId) {
    const institution = await this.repository.findInstitutionById(tenantId);
    if (!institution) {
      throw new AppError('Tenant not found', 404);
    }

    const limits = getPlanLimits(institution.plan);
    const userCount = await this.repository.countUsersByTenant(tenantId);

    if (userCount >= limits.maxUsers) {
      logger.warn(
        `User limit exceeded for tenant ${tenantId}: ${userCount}/${limits.maxUsers}`
      );
      throw new AppError(
        `User limit exceeded. Your ${institution.plan} plan allows ${limits.maxUsers} users.`,
        403,
        'PLAN_LIMIT_EXCEEDED'
      );
    }

    return true;
  }

  /**
   * Check if tenant can upload new note
   */
  async canUploadNote(tenantId) {
    const institution = await this.repository.findInstitutionById(tenantId);
    if (!institution) {
      throw new AppError('Tenant not found', 404);
    }

    const limits = getPlanLimits(institution.plan);

    if (
      institution.currentUploads &&
      institution.currentUploads >= limits.maxUploads
    ) {
      logger.warn(
        `Upload limit exceeded for tenant ${tenantId}: ${institution.currentUploads}/${limits.maxUploads}`
      );
      throw new AppError(
        `Upload limit exceeded. Your ${institution.plan} plan allows ${limits.maxUploads} uploads.`,
        403,
        'PLAN_LIMIT_EXCEEDED'
      );
    }

    return true;
  }

  /**
   * Check if tenant has storage available
   */
  async canStoreFile(tenantId, fileSizeGB) {
    const institution = await this.repository.findInstitutionById(tenantId);
    if (!institution) {
      throw new AppError('Tenant not found', 404);
    }

    const limits = getPlanLimits(institution.plan);
    const usedStorage = institution.usedStorage || 0;
    const remainingStorage = limits.storageLimit - usedStorage;

    if (remainingStorage < fileSizeGB) {
      const availableGB = remainingStorage.toFixed(2);
      logger.warn(
        `Storage limit exceeded for tenant ${tenantId}: needs ${fileSizeGB}GB, has ${availableGB}GB`
      );
      throw new AppError(
        `Storage limit exceeded. You have ${availableGB}GB remaining. Your ${institution.plan} plan allows ${limits.storageLimit}GB total.`,
        403,
        'PLAN_LIMIT_EXCEEDED'
      );
    }

    return true;
  }

  /**
   * Add to used storage
   */
  async addStorageUsage(tenantId, fileSizeGB) {
    const institution = await this.repository.findInstitutionById(tenantId);
    if (!institution) {
      throw new AppError('Tenant not found', 404);
    }

    const newUsedStorage = (institution.usedStorage || 0) + fileSizeGB;

    await this.repository.updateInstitution(tenantId, {
      usedStorage: newUsedStorage
    });

    return newUsedStorage;
  }

  /**
   * Subtract from used storage
   */
  async removeStorageUsage(tenantId, fileSizeGB) {
    const institution = await this.repository.findInstitutionById(tenantId);
    if (!institution) {
      throw new AppError('Tenant not found', 404);
    }

    const newUsedStorage = Math.max(0, (institution.usedStorage || 0) - fileSizeGB);

    await this.repository.updateInstitution(tenantId, {
      usedStorage: newUsedStorage
    });

    return newUsedStorage;
  }

  /**
   * Increment upload count
   */
  async incrementUploadCount(tenantId) {
    const institution = await this.repository.findInstitutionById(tenantId);
    if (!institution) {
      throw new AppError('Tenant not found', 404);
    }

    const newCount = (institution.currentUploads || 0) + 1;

    await this.repository.updateInstitution(tenantId, {
      currentUploads: newCount
    });

    return newCount;
  }

  /**
   * Decrement upload count
   */
  async decrementUploadCount(tenantId) {
    const institution = await this.repository.findInstitutionById(tenantId);
    if (!institution) {
      throw new AppError('Tenant not found', 404);
    }

    const newCount = Math.max(0, (institution.currentUploads || 0) - 1);

    await this.repository.updateInstitution(tenantId, {
      currentUploads: newCount
    });

    return newCount;
  }

  /**
   * Get current usage stats
   */
  async getUsageStats(tenantId) {
    const institution = await this.repository.findInstitutionById(tenantId);
    if (!institution) {
      throw new AppError('Tenant not found', 404);
    }

    const limits = getPlanLimits(institution.plan);
    const userCount = await this.repository.countUsersByTenant(tenantId);

    return {
      plan: institution.plan,
      limits: {
        maxUsers: limits.maxUsers,
        maxUploads: limits.maxUploads,
        storageLimit: limits.storageLimit
      },
      usage: {
        currentUsers: userCount,
        currentUploads: institution.currentUploads || 0,
        usedStorage: institution.usedStorage || 0
      },
      percentages: {
        users: ((userCount / limits.maxUsers) * 100).toFixed(1),
        uploads: (((institution.currentUploads || 0) / limits.maxUploads) * 100).toFixed(1),
        storage: (((institution.usedStorage || 0) / limits.storageLimit) * 100).toFixed(1)
      }
    };
  }
}

export default PlanLimitsService;

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Wallet from '../models/Wallet.js';
import User from '../models/User.js';
import { connectDatabase } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Verification script to check wallet and database consistency
 * Reports on:
 * - Wallets with missing availableBalance fields
 * - Wallets where availableBalance doesn't match calculated value
 * - Wallets where balance doesn't match User.walletBalance
 * - Pending withdrawals and their status
 */
async function verifyWalletConsistency() {
  try {
    console.log('🔍 Starting wallet consistency verification...\n');

    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected\n');

    // Get all wallets
    const wallets = await Wallet.find({}).populate('userId', 'name email walletBalance role');
    console.log(`📊 Verifying ${wallets.length} wallets\n`);

    const issues = {
      missingAvailableBalance: [],
      missingTotalWithdrawn: [],
      missingTotalPending: [],
      incorrectAvailableBalance: [],
      mismatchedUserBalance: [],
      pendingWithdrawals: [],
      orphanedWallets: []
    };

    let processedCount = 0;

    for (const wallet of wallets) {
      // Check if availableBalance field exists
      if (wallet.availableBalance === undefined || wallet.availableBalance === null) {
        issues.missingAvailableBalance.push({
          walletId: wallet._id,
          userId: wallet.userId?._id,
          userName: wallet.userId?.name
        });
      }

      if (wallet.totalWithdrawn === undefined || wallet.totalWithdrawn === null) {
        issues.missingTotalWithdrawn.push({
          walletId: wallet._id,
          userId: wallet.userId?._id,
          userName: wallet.userId?.name
        });
      }

      if (wallet.totalPendingWithdrawals === undefined || wallet.totalPendingWithdrawals === null) {
        issues.missingTotalPending.push({
          walletId: wallet._id,
          userId: wallet.userId?._id,
          userName: wallet.userId?.name
        });
      }

      // Calculate what availableBalance should be
      const pendingWithdrawals = (wallet.transactions || []).reduce((sum, txn) => {
        if (txn.type === 'debit' && txn.status === 'pending') {
          return sum + (txn.amount || 0);
        }
        return sum;
      }, 0);

      const completedWithdrawals = (wallet.transactions || []).reduce((sum, txn) => {
        if (txn.type === 'debit' && txn.status === 'completed') {
          return sum + (txn.amount || 0);
        }
        return sum;
      }, 0);

      const calculatedAvailable = Math.max(
        0,
        Number((wallet.balance - pendingWithdrawals).toFixed(2))
      );

      // Check if calculated doesn't match stored
      if (wallet.availableBalance !== undefined && Math.abs(wallet.availableBalance - calculatedAvailable) > 0.01) {
        issues.incorrectAvailableBalance.push({
          walletId: wallet._id,
          userId: wallet.userId?._id,
          userName: wallet.userId?.name,
          stored: wallet.availableBalance,
          calculated: calculatedAvailable,
          balance: wallet.balance,
          pendingWithdrawals,
          completedWithdrawals
        });
      }

      // Check if wallet balance matches user wallet balance
      if (wallet.userId && wallet.balance !== wallet.userId.walletBalance) {
        issues.mismatchedUserBalance.push({
          walletId: wallet._id,
          userId: wallet.userId?._id,
          userName: wallet.userId?.name,
          walletBalance: wallet.balance,
          userWalletBalance: wallet.userId.walletBalance
        });
      }

      // Track pending withdrawals
      const pending = wallet.transactions.filter(t => t.type === 'debit' && t.status === 'pending');
      if (pending.length > 0) {
        issues.pendingWithdrawals.push({
          walletId: wallet._id,
          userId: wallet.userId?._id,
          userName: wallet.userId?.name,
          count: pending.length,
          totalAmount: pending.reduce((sum, t) => sum + t.amount, 0),
          transactions: pending.map(t => ({
            id: t.id,
            amount: t.amount,
            timestamp: t.timestamp,
            method: t.paymentMethod
          }))
        });
      }

      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`✅ Checked ${processedCount}/${wallets.length} wallets`);
      }
    }

    // Print results
    console.log('\n📋 VERIFICATION REPORT\n');
    console.log('═'.repeat(80));

    if (issues.missingAvailableBalance.length > 0) {
      console.log(`\n⚠️  MISSING availableBalance (${issues.missingAvailableBalance.length} wallets):`);
      issues.missingAvailableBalance.slice(0, 5).forEach(w => {
        console.log(`   - User: ${w.userName} (${w.userId})`);
      });
      if (issues.missingAvailableBalance.length > 5) {
        console.log(`   ... and ${issues.missingAvailableBalance.length - 5} more`);
      }
    }

    if (issues.missingTotalWithdrawn.length > 0) {
      console.log(`\n⚠️  MISSING totalWithdrawn (${issues.missingTotalWithdrawn.length} wallets):`);
      issues.missingTotalWithdrawn.slice(0, 5).forEach(w => {
        console.log(`   - User: ${w.userName} (${w.userId})`);
      });
      if (issues.missingTotalWithdrawn.length > 5) {
        console.log(`   ... and ${issues.missingTotalWithdrawn.length - 5} more`);
      }
    }

    if (issues.incorrectAvailableBalance.length > 0) {
      console.log(`\n❌ INCORRECT availableBalance (${issues.incorrectAvailableBalance.length} wallets):`);
      issues.incorrectAvailableBalance.slice(0, 5).forEach(w => {
        console.log(`   - User: ${w.userName}`);
        console.log(`     Balance: ₹${w.balance}, Stored Available: ₹${w.stored}, Calculated: ₹${w.calculated}`);
        console.log(`     Pending: ₹${w.pendingWithdrawals}, Completed: ₹${w.completedWithdrawals}`);
      });
      if (issues.incorrectAvailableBalance.length > 5) {
        console.log(`   ... and ${issues.incorrectAvailableBalance.length - 5} more`);
      }
    }

    if (issues.mismatchedUserBalance.length > 0) {
      console.log(`\n❌ MISMATCHED User vs Wallet balance (${issues.mismatchedUserBalance.length} wallets):`);
      issues.mismatchedUserBalance.slice(0, 5).forEach(w => {
        console.log(`   - User: ${w.userName}`);
        console.log(`     Wallet: ₹${w.walletBalance}, User DB: ₹${w.userWalletBalance}`);
      });
      if (issues.mismatchedUserBalance.length > 5) {
        console.log(`   ... and ${issues.mismatchedUserBalance.length - 5} more`);
      }
    }

    if (issues.pendingWithdrawals.length > 0) {
      console.log(`\n⏳ PENDING WITHDRAWALS (${issues.pendingWithdrawals.length} wallets):`);
      let totalPendingAmount = 0;
      issues.pendingWithdrawals.forEach(w => {
        console.log(`   - User: ${w.userName}, Count: ${w.count}, Total: ₹${w.totalAmount}`);
        totalPendingAmount += w.totalAmount;
      });
      console.log(`   📊 Total pending across all users: ₹${totalPendingAmount}`);
    }

    // Summary
    console.log('\n' + '═'.repeat(80));
    console.log('\n📊 SUMMARY:');
    console.log(`   Total Wallets: ${wallets.length}`);
    console.log(`   Missing availableBalance: ${issues.missingAvailableBalance.length}`);
    console.log(`   Missing totalWithdrawn: ${issues.missingTotalWithdrawn.length}`);
    console.log(`   Missing totalPendingWithdrawals: ${issues.missingTotalPending.length}`);
    console.log(`   Incorrect availableBalance: ${issues.incorrectAvailableBalance.length}`);
    console.log(`   Mismatched balances: ${issues.mismatchedUserBalance.length}`);
    console.log(`   Wallets with pending withdrawals: ${issues.pendingWithdrawals.length}`);

    const totalIssues = Object.values(issues).reduce((sum, arr) => sum + arr.length, 0);
    if (totalIssues === 0) {
      console.log('\n✅ All wallets are consistent! No issues found.');
    } else {
      console.log(`\n⚠️  Total issues found: ${totalIssues}`);
      console.log('   Run migrateWalletBalance.js to fix missing fields');
    }

    process.exit(0);
  } catch (error) {
    console.error('💥 Verification failed:', error);
    process.exit(1);
  }
}

verifyWalletConsistency();

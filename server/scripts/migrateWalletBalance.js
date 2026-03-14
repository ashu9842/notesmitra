import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Wallet from '../models/Wallet.js';
import { connectDatabase } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Migration script to update all existing wallets with availableBalance, totalWithdrawn, and totalPendingWithdrawals
 * This script should be run once to backfill the new fields
 */
async function migrateWallets() {
  try {
    console.log('🔄 Starting wallet migration...');

    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected');

    // Get all wallets
    const wallets = await Wallet.find({});
    console.log(`📊 Found ${wallets.length} wallets to migrate`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < wallets.length; i++) {
      try {
        const wallet = wallets[i];

        // Calculate pending withdrawals
        const pendingWithdrawals = (wallet.transactions || []).reduce((sum, txn) => {
          if (txn.type === 'debit' && txn.status === 'pending') {
            return sum + (txn.amount || 0);
          }
          return sum;
        }, 0);

        // Calculate completed withdrawals
        const completedWithdrawals = (wallet.transactions || []).reduce((sum, txn) => {
          if (txn.type === 'debit' && txn.status === 'completed') {
            return sum + (txn.amount || 0);
          }
          return sum;
        }, 0);

        // Calculate available balance
        const availableBalance = Math.max(
          0,
          Number((wallet.balance - pendingWithdrawals).toFixed(2))
        );

        // Update the wallet
        await Wallet.updateOne(
          { _id: wallet._id },
          {
            $set: {
              availableBalance: availableBalance,
              totalWithdrawn: Number(completedWithdrawals.toFixed(2)),
              totalPendingWithdrawals: Number(pendingWithdrawals.toFixed(2))
            }
          }
        );

        successCount++;
        if ((i + 1) % 10 === 0) {
          console.log(`✅ Migrated ${i + 1}/${wallets.length} wallets`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error migrating wallet ${wallets[i]._id}:`, error.message);
      }
    }

    console.log(`\n📈 Migration completed!`);
    console.log(`✅ Successfully migrated: ${successCount} wallets`);
    console.log(`❌ Failed: ${errorCount} wallets`);

    if (errorCount === 0) {
      console.log('🎉 All wallets migrated successfully!');
    }

    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

migrateWallets();

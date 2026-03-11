/**
 * Fix backfill: remove platform wallet credits for pending subscriptions
 * (those were never actually paid/verified).
 * Only active, cancelled, and expired subscriptions should be credited.
 *
 * Run: node scripts/fix-premium-wallet-backfill.js
 */

import mongoose from 'mongoose';

const DB_URL = 'mongodb+srv://notesmitra:notes%409841@cluster0.1rlgbxz.mongodb.net/notesmitra?retryWrites=true&w=majority';
const PLATFORM_USER_ID = '699de2f5d22902831d2f3c02';

const walletTxnSchema = new mongoose.Schema({
  id: String, type: String, amount: Number,
  description: String, status: String, timestamp: Date
}, { _id: false });
const Wallet = mongoose.model('Wallet', new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  balance: { type: Number, default: 0 },
  transactions: [walletTxnSchema]
}), 'wallets');

const UserSubscription = mongoose.model('UserSubscription', new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  planType: String, price: Number, status: String
}, { timestamps: true }), 'usersubscriptions');

const User = mongoose.model('User', new mongoose.Schema({ walletBalance: Number }), 'users');

const run = async () => {
  await mongoose.connect(DB_URL, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ Connected to MongoDB');

  const platformWallet = await Wallet.findOne({ userId: PLATFORM_USER_ID });
  if (!platformWallet) { console.log('No platform wallet found'); process.exit(0); }

  console.log(`💰 Balance before: ₹${platformWallet.balance.toFixed(2)}`);
  console.log(`📋 Transactions before: ${platformWallet.transactions.length}\n`);

  // Find all pending subscriptions that were backfilled
  const pendingSubs = await UserSubscription.find({ price: { $gt: 0 }, status: 'pending' }).lean();
  const pendingIds = new Set(pendingSubs.map(s => s._id.toString()));

  let removed = 0;
  let removedAmount = 0;
  const toKeep = [];

  for (const txn of platformWallet.transactions) {
    // Check if this backfill txn belongs to a pending subscription
    const isPendingBackfill = txn.id?.startsWith('sub_rev_backfill_') &&
      pendingIds.has(txn.id.replace('sub_rev_backfill_', ''));

    if (isPendingBackfill) {
      console.log(`🗑️  Removing: ${txn.description?.slice(0, 80)} | ₹${txn.amount}`);
      removedAmount += txn.amount;
      removed++;
    } else {
      toKeep.push(txn);
    }
  }

  if (removed === 0) {
    console.log('\nℹ️  Nothing to remove — no pending-subscription backfills found.');
    await mongoose.disconnect(); process.exit(0);
  }

  platformWallet.transactions = toKeep;
  platformWallet.balance -= removedAmount;
  await platformWallet.save();
  await User.findByIdAndUpdate(PLATFORM_USER_ID, { walletBalance: platformWallet.balance });

  console.log(`\n✅ Removed ${removed} invalid credit(s) totalling ₹${removedAmount}`);
  console.log(`💰 Balance after: ₹${platformWallet.balance.toFixed(2)}`);
  console.log(`📋 Transactions after: ${platformWallet.transactions.length}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => { console.error('❌ Failed:', err); process.exit(1); });

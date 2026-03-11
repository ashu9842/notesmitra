/**
 * Backfill Platform Wallet for Premium Subscriptions
 *
 * Finds all active (and cancelled/expired) paid premium subscriptions that
 * don't already have a matching platform wallet transaction, and credits the
 * platform wallet for each one.
 *
 * Run once: node scripts/backfill-premium-wallet.js
 */

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const DB_URL = 'mongodb+srv://notesmitra:notes%409841@cluster0.1rlgbxz.mongodb.net/notesmitra?retryWrites=true&w=majority';
const PLATFORM_USER_ID = '699de2f5d22902831d2f3c02';

// ── Minimal inline schemas (avoids importing full model tree) ──────────────────

const walletTxnSchema = new mongoose.Schema({
  id: String,
  type: { type: String },
  amount: Number,
  description: String,
  status: String,
  timestamp: Date
}, { _id: false });

const walletSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  balance: { type: Number, default: 0 },
  transactions: [walletTxnSchema]
});
const Wallet = mongoose.model('Wallet', walletSchema, 'wallets');

const subSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  planType: String,
  price: Number,
  status: String,
  transactionId: String,
  paymentMethod: String,
  createdAt: Date
}, { timestamps: true });
const UserSubscription = mongoose.model('UserSubscription', subSchema, 'usersubscriptions');

const userSchema = new mongoose.Schema({
  walletBalance: Number
});
const User = mongoose.model('User', userSchema, 'users');

// ── Main ───────────────────────────────────────────────────────────────────────

const run = async () => {
  await mongoose.connect(DB_URL, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ Connected to MongoDB');

  // Load platform wallet (create if missing)
  let platformWallet = await Wallet.findOne({ userId: PLATFORM_USER_ID });
  if (!platformWallet) {
    platformWallet = await Wallet.create({ userId: PLATFORM_USER_ID, balance: 0, transactions: [] });
    console.log('ℹ️  Platform wallet created (was missing)');
  }

  console.log(`\n💰 Platform wallet current balance: ₹${platformWallet.balance.toFixed(2)}`);
  console.log(`📋 Existing transactions: ${platformWallet.transactions.length}\n`);

  // Find all paid premium subscriptions (price > 0)
  const subs = await UserSubscription.find({ price: { $gt: 0 } }).lean();
  console.log(`🔍 Found ${subs.length} paid premium subscription(s) in DB\n`);

  let credited = 0;
  let skipped = 0;

  for (const sub of subs) {
    const subId = sub._id.toString();
    const marker = `sub_rev_backfill_${subId}`;

    // Skip if already has a transaction for this subscription
    const already = platformWallet.transactions.some(
      t => t.id === marker || (t.description && t.description.includes(subId))
    );

    if (already) {
      console.log(`⏭️  Skip (already credited): ${sub.planType} ₹${sub.price} [${subId}]`);
      skipped++;
      continue;
    }

    platformWallet.balance += sub.price;
    platformWallet.transactions.unshift({
      id: marker,
      type: 'credit',
      amount: sub.price,
      description: `[Backfill] Premium subscription revenue: ${sub.planType} (User: ${sub.userId}, Sub: ${subId}, Status: ${sub.status})`,
      status: 'completed',
      timestamp: sub.createdAt || new Date()
    });

    console.log(`✅ Credited: ${sub.planType} ₹${sub.price} | user=${sub.userId} | status=${sub.status}`);
    credited++;
  }

  if (credited > 0) {
    await platformWallet.save();
    await User.findByIdAndUpdate(PLATFORM_USER_ID, { walletBalance: platformWallet.balance });
    console.log(`\n🎉 Backfill complete! Credited ${credited} subscription(s).`);
    console.log(`💰 New platform wallet balance: ₹${platformWallet.balance.toFixed(2)}`);
  } else {
    console.log('\nℹ️  Nothing to backfill — all subscriptions already reflected.');
  }

  console.log(`\nSummary: ${credited} credited | ${skipped} already existed`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});

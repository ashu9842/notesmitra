# Withdrawal & Earnings Logic - Fixed & Clarified

**Date**: March 14, 2026  
**Issue Fixed**: Platform and seller withdrawal tracking with proper earnings updates

---

## 📊 Field Definitions

### User Model Fields
```javascript
totalEarnings: Number        // Total earned from sales (NEVER decreases)
totalSpent: Number           // Total spent on purchases (NEVER decreases)
walletBalance: Number        // Current balance in wallet (decreases on pending withdrawal)
```

### Wallet Model Fields
```javascript
balance: Number              // Current balance (decreases on withdrawal)
availableBalance: Number     // Can withdraw (balance - pending withdrawals)
totalWithdrawn: Number       // Total completed withdrawals (auto-calculated)
totalPendingWithdrawals: Number // Current pending withdrawal amount
```

---

## 🔄 Withdrawal Workflow

### Stage 1: Withdrawal Requested (PENDING)
```
When: User requests withdrawal
Events:
  ✓ Wallet.balance: DECREASES (₹100 → ₹850)
  ✓ Wallet.availableBalance: DECREASES (₹1000 → ₹900)
  ✓ User.walletBalance: DECREASES (₹100 → ₹850)
  ✓ Transaction: Created with status='pending'
  
NOT CHANGED:
  ✗ User.totalEarnings: STAYS SAME (still ₹1000)
  ✗ Wallet.totalWithdrawn: STAYS SAME (still ₹0)
```

**Why totalEarnings NOT changed?**
- totalEarnings = lifetime earnings from sales
- Withdrawal is just moving money OUT, not reducing what was earned
- Seller still "earned" ₹1000, they're just withdrawing part of it

---

### Stage 2: Withdrawal Completed (COMPLETED)
```
When: Admin approves & sends money to seller's UPI
Events:
  ✓ Wallet.balance: STAYS SAME (₹850)
  ✓ Wallet.totalWithdrawn: INCREASES (₹0 → ₹150)
  ✓ Wallet.availableBalance: INCREASES (₹900 → ₹900)
  ✓ Transaction: Status changed from 'pending' to 'completed'
  
NOT CHANGED:
  ✗ User.walletBalance: STAYS SAME (₹850)
  ✗ User.totalEarnings: STAYS SAME (₹1000)
```

**Key Point:**
- Money already deducted from balance when PENDING
- Completion just marks it as transferred
- totalEarnings remains lifetime earnings

---

## 📈 Full Example Scenario

### Initial State (Seller with ₹1000 earnings)
```
User.totalEarnings = ₹1000
User.walletBalance = ₹1000
Wallet.balance = ₹1000
Wallet.availableBalance = ₹1000
Wallet.totalWithdrawn = ₹0
Wallet.totalPendingWithdrawals = ₹0
```

### After Sale (Sale worth ₹500, 80% to seller)
```
User.totalEarnings = ₹1500        ← INCREASED
User.walletBalance = ₹1400        ← INCREASED
Wallet.balance = ₹1400            ← INCREASED
Wallet.availableBalance = ₹1400   ← INCREASED
Wallet.totalWithdrawn = ₹0        ← SAME
Wallet.totalPendingWithdrawals = ₹0 ← SAME
```

### After Withdrawal Request (₹300)
```
User.totalEarnings = ₹1500        ← SAME (NOT decreased)
User.walletBalance = ₹1100        ← DECREASED
Wallet.balance = ₹1100            ← DECREASED
Wallet.availableBalance = ₹800    ← DECREASED (₹1100 - ₹300 pending)
Wallet.totalWithdrawn = ₹0        ← SAME (not completed yet)
Wallet.totalPendingWithdrawals = ₹300 ← INCREASED
```

### After Withdrawal Completed
```
User.totalEarnings = ₹1500        ← SAME
User.walletBalance = ₹1100        ← SAME (already deducted)
Wallet.balance = ₹1100            ← SAME
Wallet.availableBalance = ₹1100   ← INCREASED (no more pending)
Wallet.totalWithdrawn = ₹300      ← INCREASED (now completed)
Wallet.totalPendingWithdrawals = ₹0 ← DECREASED
```

---

## ✅ Correct Logic (NOW IMPLEMENTED)

### withdrawFunds() - Request Withdrawal
```javascript
// ✅ CORRECT
wallet.balance -= amount                  // Remove from balance
wallet.availableBalance -= amount         // Reserve from available
User.walletBalance -= amount              // Update user balance

// ✗ DO NOT DO THESE:
User.totalEarnings -= amount              // WRONG! This is lifetime earnings
Wallet.totalWithdrawn -= amount           // WRONG! Not completed yet
```

### completeWithdrawal() - Approve Withdrawal
```javascript
// ✅ CORRECT
transaction.status = 'completed'          // Mark as done
wallet.totalWithdrawn += amount           // Auto-calculated via updateAvailableBalance()

// ✗ DO NOT DO THESE:
wallet.balance -= amount                  // WRONG! Already deducted when pending
User.totalEarnings -= amount              // WRONG! Never decrease
User.walletBalance -= amount              // WRONG! Already updated when pending
```

---

## 📋 Summary Table

| Event | balance | walletBalance | totalEarnings | availableBalance | totalWithdrawn | totalPending |
|-------|---------|---------------|---------------|------------------|----------------|--------------|
| **Sale (+₹500)** | ↑ | ↑ | ↑ | ↑ | — | — |
| **Withdrawal Req (-₹300)** | ↓ | ↓ | — | ↓ | — | ↑ |
| **Withdrawal Complete** | — | — | — | ↑ | ↑ | ↓ |

Legend: ↑ = increases, ↓ = decreases, — = no change

---

## 🎯 Key Rules (ENFORCED)

### NEVER update totalEarnings on withdrawal
```javascript
// ✗ WRONG
User.totalEarnings -= withdrawalAmount

// ✅ CORRECT
// Leave totalEarnings alone - it's lifetime earnings
```

### Balance deducted IMMEDIATELY on pending withdrawal
```javascript
// ✅ CORRECT
wallet.balance -= amount                  // Immediate deduction

// ✗ WRONG
// Only deduct when completed - confuses available balance
```

### Total earnings only increases on ACTUAL earnings
```javascript
// ✅ CORRECT - When seller makes a sale
User.totalEarnings += sellerEarnings

// ✗ WRONG - On withdrawal
User.totalEarnings -= withdrawalAmount
```

---

## 🔍 Verification Queries

### Check if earnings are being tracked correctly
```javascript
const user = await User.findById(userId)
                      .select('totalEarnings walletBalance totalSpent');

console.log({
  totalEarnings: user.totalEarnings,     // Should only ↑ from sales
  walletBalance: user.walletBalance,     // Should ↓ on withdrawal
  totalSpent: user.totalSpent            // Should only ↑ from purchases
});
```

### Verify wallet consistency
```javascript
const wallet = await Wallet.findOne({ userId });

console.log({
  balance: wallet.balance,
  availableBalance: wallet.availableBalance,
  totalWithdrawn: wallet.totalWithdrawn,
  totalPendingWithdrawals: wallet.totalPendingWithdrawals
});

// Should satisfy:
// balance === User.walletBalance
// availableBalance === Math.max(0, balance - totalPendingWithdrawals)
// totalWithdrawn === sum of {completed} debits
```

---

## 🚀 Code Changes Made

### walletController.js - withdrawFunds()
✅ Added comment explaining totalEarnings is NOT updated  
✅ Only update walletBalance, not totalEarnings

### walletController.js - completeWithdrawal()
✅ Added comment explaining totalEarnings stays the same  
✅ Confirm totalWithdrawn is auto-updated via updateAvailableBalance()  
✅ Return withdrawnAmount in response for audit trail

---

## 📝 Documentation

Filed under: WALLET_FIX_DOCUMENTATION.md

This clarifies:
- totalEarnings remains "lifetime earnings" (never decreases)
- walletBalance represents current available (decreases on pending withdrawal)
- Withdrawal workflow: pending (deduct) → completed (transfer)
- Platform wallet follows same rules as seller wallet

---

## ✅ Fixed Behavior

**Before**: totalEarnings might be incorrectly updated on withdrawal  
**After**: totalEarnings only updates on actual sales/earnings

**Platform Wallet**: Now correctly tracks withdrawals like seller wallets  
**Seller Wallet**: Withdrawals properly reserve funds without affecting earnings

---

**Status**: ✅ FIXED

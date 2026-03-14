# Wallet System - Platform & Seller Wallet Logic Fix

## Overview
This document describes the fixes applied to the wallet system to properly handle platform wallet and seller wallet logic with correct available balance calculations.

## Issues Fixed

### 1. **Missing Available Balance Tracking**
- **Problem**: Wallets only tracked total `balance`, not `availableBalance`
- **Impact**: Sellers couldn't distinguish between total earnings and withdrawable amount
- **Solution**: Added `availableBalance`, `totalWithdrawn`, and `totalPendingWithdrawals` fields to Wallet model

### 2. **Inconsistent Balance Calculations**
- **Problem**: `availableBalance` was calculated on-the-fly in controller, leading to inconsistencies
- **Impact**: Different API responses could show different available balances
- **Solution**: Added `calculateAvailableBalance()` and `updateAvailableBalance()` methods to Wallet model

### 3. **No Proper Pending Withdrawal Handling**
- **Problem**: Pending withdrawals decremented balance but didn't update available balance
- **Impact**: Users could request withdrawals exceeding their actual available amount
- **Solution**: Made `updateAvailableBalance()` calculate available as: `balance - pendingWithdrawals`

### 4. **Platform Wallet Not Tracking Available Balance**
- **Problem**: Platform wallet only tracked total balance, no withdrawal support
- **Impact**: No way to monitor platform's available commission funds
- **Solution**: Platform wallet now also tracks available balance and can withdraw like seller wallets

## Changes Made

### 1. **Wallet Model (`server/models/Wallet.js`)**
```javascript
// New fields added:
availableBalance: Number      // balance - pending withdrawals
totalWithdrawn: Number        // total amount successfully withdrawn
totalPendingWithdrawals: Number // current pending withdrawal requests

// New methods:
calculateAvailableBalance()   // Returns calculation object
updateAvailableBalance()      // Updates all three fields based on transactions
```

**Formula for availableBalance:**
```
availableBalance = MAX(0, balance - pendingWithdrawals)
```

### 2. **Wallet Controller (`server/controllers/walletController.js`)**

#### `getWallet()`
- Now calls `updateAvailableBalance()` before returning
- Recalculates available balance on every request
- Returns consistent `availableBalance` value

#### `addFunds()`
- Calls `updateAvailableBalance()` after credit transaction
- Available balance equals total balance (no pending debits from add)

#### `withdrawFunds()`
- Checks `availableBalance` before allowing withdrawal
- Creates pending transaction (doesn't complete immediately)
- Updates available balance after adding withdrawal request
- Available balance now reflects that funds are reserved

#### `completeWithdrawal()`
- Marks transaction as completed (not pending anymore)
- Updates available balance
- Completed withdrawals no longer reduce available balance

### 3. **Payment Service (`server/services/paymentService.js`)**
- All wallet create operations now initialize `availableBalance: 0`
- Seller wallet receives credit: balance increased + `updateAvailableBalance()` called
- Buyer wallet receives debit: balance decreased + `updateAvailableBalance()` called
- Platform wallet receives credit: balance increased + `updateAvailableBalance()` called

### 4. **Razorpay Controller (`server/controllers/razorpayController.js`)**
- Same updates as payment service
- Razorpay wallet recharge: creates with `availableBalance: 0`, updates after credit
- Seller earnings credit: updates available balance
- Platform commission credit: updates available balance

## Data Flow

### Credit Transaction (Seller earns from sale)
```
Seller makes ₹100 sale
├─ Seller wallet balance: 0 → 100
├─ Transaction: { type: 'credit', amount: 100, status: 'completed' }
├─ calculateAvailableBalance():
│  ├─ pendingWithdrawals = 0
│  ├─ completedWithdrawals = 0
│  └─ availableBalance = 100 - 0 = 100
└─ Seller can withdraw up to ₹100
```

### Debit Transaction - Pending (Seller requests withdrawal)
```
Seller requests withdrawal of ₹50
├─ Seller wallet balance: 100 → 50  (immediately deducted)
├─ Transaction: { type: 'debit', amount: 50, status: 'pending' }
├─ calculateAvailableBalance():
│  ├─ pendingWithdrawals = 50
│  ├─ completedWithdrawals = 0 (not including pending)
│  └─ availableBalance = 50 - 50 = 0
└─ Seller's available balance is now 0 (reserved for withdrawal)
```

### Complete Withdrawal (Admin approves)
```
Admin completes withdrawal
├─ Transaction status: 'pending' → 'completed'
├─ Wallet balance: remains 50 (already deducted)
├─ calculateAvailableBalance():
│  ├─ pendingWithdrawals = 0 (no longer pending)
│  ├─ completedWithdrawals = 50
│  └─ availableBalance = 50 - 0 = 50
└─ Available balance restored (money was transferred to bank)
```

## Database Migration

### Scripts Provided
1. **`migrateWalletBalance.js`** - Updates all existing wallets with calculated values
2. **`verifyWalletConsistency.js`** - Checks for data consistency issues

### How to Run Migration

```bash
# Verify current state
node server/scripts/verifyWalletConsistency.js

# Run migration
node server/scripts/migrateWalletBalance.js

# Verify after migration
node server/scripts/verifyWalletConsistency.js
```

### What Migration Does
- Calculates pending withdrawals from transactions
- Calculates completed withdrawals from transactions
- Sets `availableBalance = balance - pendingWithdrawals`
- Updates all three new fields for every existing wallet

## API Behavior

### GET /api/wallet
```json
{
  "success": true,
  "wallet": {
    "_id": "wallet-id",
    "userId": "user-id",
    "balance": 1000,
    "availableBalance": 750,
    "totalWithdrawn": 100,
    "totalPendingWithdrawals": 150,
    "transactions": [...]
  },
  "withdrawableBalance": 750
}
```

### POST /api/wallet/withdraw
- Checks against `availableBalance`, not total balance
- Example: `{ balance: 1000, availableBalance: 750 }`
- Can only withdraw up to ₹750, not ₹1000

### Withdrawal Request Flow
1. **Status**: Pending → Balance decreases, available balance decreases
2. **Admin approval**: Pending → Completed → Available balance increases (money transferred out)

## Platform Wallet (Admin)

The platform wallet now works the same as seller wallets:
- Receives commission from every sale
- Can request withdrawals
- Available balance tracked separately
- Total withdrawals tracked

Platform can see:
- Total commission earned (balance)
- Amount available for withdrawal (availableBalance)
- Amount already withdrawn (totalWithdrawn)
- Pending withdrawal requests (totalPendingWithdrawals)

## Key Improvements

✅ **Accurate Available Balance**: More precise than old `getSellerWithdrawableBalance()` function
✅ **Consistent Across API**: Same calculation everywhere, not on-the-fly
✅ **Pending Funds Reserved**: Can't withdraw funds with pending requests
✅ **Platform Wallet Parity**: Platform wallet behaves like seller wallets
✅ **Transaction History**: Full audit trail of all balance changes
✅ **Withdrawal Workflow**: Clear pending → completed states

## Testing Checklist

- [ ] Run `verifyWalletConsistency.js` - should show no issues
- [ ] Run `migrateWalletBalance.js` - should migrate all wallets
- [ ] Test seller withdrawal: request → pending → complete
- [ ] Test platform wallet balance calculation
- [ ] Verify `GET /api/wallet` returns correct `availableBalance`
- [ ] Test concurrent transactions don't corrupt balance
- [ ] Verify buyer wallet balance updates correctly
- [ ] Check User.walletBalance matches Wallet.balance

## Backward Compatibility

- Old `getSellerWithdrawableBalance()` function still exists but is not used
- Can be removed in future cleanup
- All new wallet operations use `updateAvailableBalance()` method
- Existing transactions are preserved, only new fields are added

---

**Last Updated**: March 14, 2026
**Status**: ✅ Implemented and Ready for Migration

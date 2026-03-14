# Wallet System - Visual Flow Diagrams

## 1. Available Balance Calculation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      WALLET STATE                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User earns from sales:  ₹1000                             │
│  ├─ balance: 1000                                          │
│  └─ availableBalance: 1000                                 │
│                                                              │
│  User requests withdrawal:  ₹300 (marked as pending)       │
│  ├─ balance: 700     (immediately deducted)               │
│  ├─ availableBalance: 700 - 300 = 400                      │
│  ├─ totalPendingWithdrawals: 300                          │
│  └─ Transaction: { type: 'debit', amount: 300, status: 'pending' }
│                                                              │
│  Admin approves withdrawal                                 │
│  ├─ balance: 700     (no change)                          │
│  ├─ availableBalance: 700 (funds transferred ✓)           │
│  ├─ totalPendingWithdrawals: 0                            │
│  ├─ totalWithdrawn: 300                                    │
│  └─ Transaction: { type: 'debit', amount: 300, status: 'completed' }
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 2. Wallet Transaction Flow

```
                    START: Sale Completed
                           │
                           ▼
        ┌──────────────────────────────────┐
        │   SELLER WALLET CREDIT           │
        └──────────────────────────────────┘
             │                      │
             ▼                      ▼
        balance += 100      availableBalance += 100
        (₹900 → ₹1000)      (₹900 → ₹1000)
             │                      │
             └──────────────────────┘
                     │
                     ▼
        ┌──────────────────────────────────┐
        │   PLATFORM WALLET CREDIT         │
        └──────────────────────────────────┘
             │                      │
             ▼                      ▼
        balance += 22       availableBalance += 22
        (₹5000 → ₹5022)     (₹5000 → ₹5022)
             │                      │
             └──────────────────────┘
                     │
                     ▼
        ┌──────────────────────────────────┐
        │   BUYER WALLET DEBIT             │
        └──────────────────────────────────┘
             │                      │
             ▼                      ▼
        balance -= 123      availableBalance -= 123
        (₹500 → ₹377)       (₹500 → ₹377)
             │                      │
             └──────────────────────┘
                     │
                     ▼
              TRANSACTION RECORDED
```

## 3. Withdrawal Request State Machine

```
┌─────────────────────────┐
│   INITIAL STATE         │
│ balance: 1000           │
│ availableBalance: 1000  │
│ totalPending: 0         │
│ totalWithdrawn: 0       │
└──────────────┬──────────┘
               │
               │ request withdrawal ₹300
               ▼
┌─────────────────────────┐
│   PENDING STATE         │
│ balance: 700            │◄─── Balance deducted immediately
│ availableBalance: 400   │◄─── Available reduced (reserved)
│ totalPending: 300       │◄─── Tracked separately
│ totalWithdrawn: 0       │
│ Transaction: pending    │
└──────────────┬──────────┘
               │
               │ admin approves
               ▼
┌─────────────────────────┐
│   COMPLETED STATE       │
│ balance: 700            │
│ availableBalance: 700   │◄─── Money transferred ✓
│ totalPending: 0         │◄─── No longer pending
│ totalWithdrawn: 300     │◄─── Added to completed
│ Transaction: completed  │
└─────────────────────────┘
```

## 4. Available Balance Calculation

```
FORMULA:
availableBalance = MAX(0, balance - pendingWithdrawals)

EXAMPLE SCENARIOS:

Scenario 1: No Pending Withdrawals
┌─────────────────────────────────────┐
│ balance: 1000                       │
│ pendingWithdrawals: 0               │
│ availableBalance: 1000 - 0 = 1000   │
│ Can withdraw: ₹1000                 │
└─────────────────────────────────────┘

Scenario 2: Some Pending Withdrawals
┌─────────────────────────────────────┐
│ balance: 1000                       │
│ pendingWithdrawals: 300             │
│ availableBalance: 1000 - 300 = 700  │
│ Can withdraw: ₹700 more             │
└─────────────────────────────────────┘

Scenario 3: All Funds Reserved
┌─────────────────────────────────────┐
│ balance: 1000                       │
│ pendingWithdrawals: 1000            │
│ availableBalance: 1000 - 1000 = 0   │
│ Can withdraw: ₹0 (all reserved)     │
└─────────────────────────────────────┘

Scenario 4: Negative Result (Clamped to 0)
┌─────────────────────────────────────┐
│ balance: 500                        │
│ pendingWithdrawals: 800 (error)     │
│ availableBalance: MAX(0, -300) = 0  │
│ Can withdraw: ₹0                    │
└─────────────────────────────────────┘
```

## 5. Database Update Flow

```
                    API Request
                         │
                         ▼
            ┌────────────────────────┐
            │  Load Wallet from DB   │
            └────────────┬───────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │  Process Transaction   │
            │  (add funds, withdraw) │
            └────────────┬───────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │ updateAvailableBalance │
            │ - Calculate pending    │
            │ - Calculate completed  │
            │ - Set availableBalance │
            │ - Set totalPending     │
            │ - Set totalWithdrawn   │
            └────────────┬───────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │   Save Wallet to DB    │
            └────────────┬───────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │   Update User Profile  │
            │   (walletBalance)      │
            └────────────┬───────────┘
                         │
                         ▼
                   Return Response
```

## 6. Data Types at Each Stage

```
WALLET OBJECT IN RESPONSE:
{
  _id: ObjectId,
  userId: ObjectId,
  tenantId: ObjectId,
  
  // Financial fields
  balance: Number               ← Total money in wallet
  availableBalance: Number      ← Can be withdrawn
  totalWithdrawn: Number        ← Total completed withdrawals
  totalPendingWithdrawals: Number ← Current pending requests
  
  // Transaction history
  transactions: [
    {
      id: String                ← Unique transaction ID
      type: 'credit'|'debit'   ← Money in or out
      amount: Number            ← Transaction amount
      status: 'pending'|'completed'|'failed'
      timestamp: Date
      description: String
    }
  ],
  
  // Metadata
  createdAt: Date,
  updatedAt: Date
}
```

## 7. Migration Impact

```
BEFORE MIGRATION:
[
  { _id: 1, balance: 1000 },
  { _id: 2, balance: 500 }
]
Missing: availableBalance, totalWithdrawn, totalPendingWithdrawals

AFTER MIGRATION:
[
  { 
    _id: 1, 
    balance: 1000,
    availableBalance: 1000,
    totalWithdrawn: 0,
    totalPendingWithdrawals: 0
  },
  { 
    _id: 2, 
    balance: 500,
    availableBalance: 400,
    totalWithdrawn: 100,
    totalPendingWithdrawals: 0
  }
]

Values calculated from transaction history
in each wallet document
```

## 8. Seller vs Platform Wallet

```
SELLER WALLET:
┌──────────────────────┐
│ Sources of balance:  │
│ - Sales earnings     │ ← Note sale
│ - Bonus/credits      │ ← Admin add
│                      │
│ Can withdraw: YES    │
│ Pending requests: YES│
│ Available balance: YES
└──────────────────────┘

PLATFORM WALLET:
┌──────────────────────┐
│ Sources of balance:  │
│ - Commission (2%)    │ ← Gateway fee
│ - Service fee (20%)  │ ← Platform cut
│ - Admin bonuses      │ ← Manual credit
│                      │
│ Can withdraw: YES    │ ← NOW (previously NO)
│ Pending requests: YES│ ← NOW (previously NO)
│ Available balance: YES
└──────────────────────┘

BOTH NOW USE SAME LOGIC:
availableBalance = balance - pendingWithdrawals
```

## 9. Error Handling

```
WITHDRAWAL REQUEST VALIDATION:
      │
      ▼
  ┌───────────────┐
  │ Load wallet   │
  └───────┬───────┘
          │
          ▼
  ┌───────────────────────────────┐
  │ availableBalance >= amount? │
  └───┬─────────────────────┬───┘
      │ YES                  │ NO
      ▼                      ▼
   approve            reject ❌
   pending          "Insufficient available balance"
   transaction

EXAMPLE:
Available: ₹800
Request: ₹1000  ──► DENIED ❌
Request: ₹500   ──► APPROVED ✓
Request: ₹300   ──► APPROVED ✓ (if not reserved)
```

---

These diagrams show:
1. How available balance is calculated and updated
2. The flow of transactions through the system
3. State changes for withdrawal requests
4. The data structure and types
5. How migration transforms existing data
6. How both seller and platform wallets work the same way
7. Error handling and validation

For code implementation details, see WALLET_FIX_DOCUMENTATION.md

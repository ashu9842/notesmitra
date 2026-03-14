# Database Schema Changes - Before & After

## Wallet Collection Schema

### BEFORE (Original)
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  userId: ObjectId,
  unique: true,
  
  balance: Number,
  // ❌ Missing: availableBalance
  // ❌ Missing: totalWithdrawn  
  // ❌ Missing: totalPendingWithdrawals
  
  transactions: [
    {
      id: String,
      type: 'credit' | 'debit',
      amount: Number,
      description: String,
      paymentMethod: String,
      status: 'completed' | 'pending' | 'failed',
      timestamp: Date
    }
  ],
  
  createdAt: Date,
  updatedAt: Date
}
```

### AFTER (Fixed)
```javascript
{
  _id: ObjectId,
  tenantId: ObjectId,
  userId: ObjectId,
  unique: true,
  
  balance: Number,                    // Total money in wallet
  availableBalance: Number,           // ✅ NEW: Money available to withdraw
  totalWithdrawn: Number,             // ✅ NEW: Total completed withdrawals
  totalPendingWithdrawals: Number,    // ✅ NEW: Reserved funds
  
  transactions: [
    {
      id: String,
      type: 'credit' | 'debit',
      amount: Number,
      description: String,
      paymentMethod: String,
      status: 'completed' | 'pending' | 'failed',
      timestamp: Date
    }
  ],
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## Migration Examples

### Example 1: Simple Case (No Pending Withdrawals)
```javascript
// BEFORE:
{
  _id: ObjectId("user123"),
  userId: ObjectId("seller1"),
  balance: 1000,
  transactions: [
    { type: 'credit', amount: 1000, status: 'completed' }
  ]
}

// AFTER:
{
  _id: ObjectId("user123"),
  userId: ObjectId("seller1"),
  balance: 1000,
  availableBalance: 1000,         // ← 1000 - 0 pending
  totalWithdrawn: 0,              // ← No completed debits
  totalPendingWithdrawals: 0,     // ← No pending debits
  transactions: [
    { type: 'credit', amount: 1000, status: 'completed' }
  ]
}
```

### Example 2: With Pending Withdrawal
```javascript
// BEFORE:
{
  _id: ObjectId("user456"),
  userId: ObjectId("seller2"),
  balance: 700,                   // Already deducted
  transactions: [
    { type: 'credit', amount: 1000, status: 'completed' },
    { type: 'debit', amount: 300, status: 'pending' }   // ← Pending
  ]
}

// AFTER:
{
  _id: ObjectId("user456"),
  userId: ObjectId("seller2"),
  balance: 700,
  availableBalance: 400,          // ← 700 - 300 pending = 400
  totalWithdrawn: 0,              // ← No completed debits yet
  totalPendingWithdrawals: 300,   // ← 300 pending (reserved)
  transactions: [
    { type: 'credit', amount: 1000, status: 'completed' },
    { type: 'debit', amount: 300, status: 'pending' }
  ]
}
```

### Example 3: With Completed Withdrawals
```javascript
// BEFORE:
{
  _id: ObjectId("user789"),
  userId: ObjectId("seller3"),
  balance: 600,
  transactions: [
    { type: 'credit', amount: 1000, status: 'completed' },
    { type: 'debit', amount: 200, status: 'completed' },  // Withdrawn
    { type: 'debit', amount: 200, status: 'completed' }   // Withdrawn
  ]
}

// AFTER:
{
  _id: ObjectId("user789"),
  userId: ObjectId("seller3"),
  balance: 600,
  availableBalance: 600,          // ← 600 - 0 pending = 600
  totalWithdrawn: 400,            // ← Two 200 withdrawals completed
  totalPendingWithdrawals: 0,     // ← No pending withdrawals
  transactions: [
    { type: 'credit', amount: 1000, status: 'completed' },
    { type: 'debit', amount: 200, status: 'completed' },
    { type: 'debit', amount: 200, status: 'completed' }
  ]
}
```

### Example 4: Complex Case
```javascript
// BEFORE:
{
  _id: ObjectId("user999"),
  userId: ObjectId("seller4"),
  balance: 1200,
  transactions: [
    { type: 'credit', amount: 2000, status: 'completed' },
    { type: 'debit', amount: 300, status: 'pending' },    // Pending
    { type: 'debit', amount: 400, status: 'completed' },  // Withdrawn
    { type: 'debit', amount: 100, status: 'completed' }   // Withdrawn
  ]
}

// AFTER:
{
  _id: ObjectId("user999"),
  userId: ObjectId("seller4"),
  balance: 1200,
  availableBalance: 900,          // ← 1200 - 300 pending = 900
  totalWithdrawn: 500,            // ← 400 + 100 completed
  totalPendingWithdrawals: 300,   // ← One pending withdrawal
  transactions: [
    { type: 'credit', amount: 2000, status: 'completed' },
    { type: 'debit', amount: 300, status: 'pending' },
    { type: 'debit', amount: 400, status: 'completed' },
    { type: 'debit', amount: 100, status: 'completed' }
  ]
}
```

---

## Index Changes

### BEFORE
```javascript
// Compound unique index
walletSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
```

### AFTER
```javascript
// Compound unique index (unchanged)
walletSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

// New index for available balance queries
walletSchema.index({ userId: 1, availableBalance: 1 });
```

---

## Field Constraints

### New Fields Validation
```javascript
availableBalance: {
  type: Number,
  default: 0,                                    // ← Default value
  min: [0, 'Available balance cannot be negative']  // ← Non-negative
}

totalWithdrawn: {
  type: Number,
  default: 0,                                    // ← Default value
  min: [0, 'Total withdrawn cannot be negative']   // ← Non-negative
}

totalPendingWithdrawals: {
  type: Number,
  default: 0,                                    // ← Default value
  min: [0, 'Pending withdrawals cannot be negative'] // ← Non-negative
}
```

---

## Query Examples

### Query Available Balance
```javascript
// ❌ OLD WAY (Calculate on fly):
const wallet = await Wallet.findOne({ userId });
const available = wallet.balance - (pending withdrawals);

// ✅ NEW WAY (Direct query):
const wallet = await Wallet.findOne({ userId });
const available = wallet.availableBalance;  // Direct field
```

### Find Wallets with Available Funds
```javascript
// ❌ OLD WAY (Had to load all):
const wallets = await Wallet.find({});
const withFunds = wallets.filter(w => w.balance > 100);

// ✅ NEW WAY (Use index):
const wallets = await Wallet.find({ availableBalance: { $gt: 100 } });
// Uses new index: { userId: 1, availableBalance: 1 }
```

### Find Pending Withdrawals
```javascript
// ❌ OLD WAY (Complex aggregation):
const pending = await Wallet.aggregate([
  { $match: { 'transactions.status': 'pending' } },
  { $unwind: '$transactions' },
  { $match: { 'transactions.status': 'pending' } }
]);

// ✅ NEW WAY (Simple field check):
const pending = await Wallet.find({ totalPendingWithdrawals: { $gt: 0 } });
```

### Calculate Total Pending Platform-Wide
```javascript
// ❌ OLD WAY (Complex aggregation):
const result = await Wallet.aggregate([
  { $unwind: '$transactions' },
  { $match: { 'transactions.status': 'pending' } },
  { $group: { _id: null, total: { $sum: '$transactions.amount' } } }
]);

// ✅ NEW WAY (Simple sum):
const wallets = await Wallet.find({ totalPendingWithdrawals: { $gt: 0 } });
const total = wallets.reduce((sum, w) => sum + w.totalPendingWithdrawals, 0);
```

---

## Data Type Mapping

| Field | Type | Example | Purpose |
|-------|------|---------|---------|
| balance | Number | 1000 | Total money earned/credited |
| availableBalance | Number | 700 | Money that can be withdrawn now |
| totalWithdrawn | Number | 100 | Total amount withdrawn (completed) |
| totalPendingWithdrawals | Number | 200 | Withdrawals reserved but pending approval |

---

## Calculation Relationships

```
balance + totalWithdrawn = Total historical inflow
(after adjusting for pending)

Example:
- Earned: ₹2000
- Withdrawn (completed): ₹500
- balance: ₹1500
- totalWithdrawn: ₹500
- Total inflow: 1500 + 500 = 2000 ✓

With pending:
- Earned: ₹2000
- Withdrawn (completed): ₹500
- balance: ₹1200 (₹1500 - ₹300 pending)
- totalWithdrawn: ₹500
- totalPendingWithdrawals: ₹300
- After pending completes: balance = ₹900, totalWithdrawn = ₹800
- Math: 900 + 800 = 1700 (lost ₹300 from original?)
  NO! Because pending was also deducted:
  Pre-pending: 1500 + 500 = 2000
  Post-pending: (1500 - 300) + 500 = 1700
  Pending: 300
  Total: 1700 + 300 = 2000 ✓
```

---

## Migration SQL Example (for reference)

If using MongoDB console:
```javascript
// Step 1: Update all wallets with new fields
db.wallets.updateMany({}, [
  {
    $set: {
      totalPendingWithdrawals: {
        $sum: [
          {
            $reduce: {
              input: { $ifNull: ['$transactions', []] },
              initialValue: 0,
              in: {
                $cond: [
                  { $and: [
                    { $eq: ['$$this.type', 'debit'] },
                    { $eq: ['$$this.status', 'pending'] }
                  ]},
                  { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] },
                  '$$value'
                ]
              }
            }
          }
        ]
      },
      totalWithdrawn: {
        $sum: [
          {
            $reduce: {
              input: { $ifNull: ['$transactions', []] },
              initialValue: 0,
              in: {
                $cond: [
                  { $and: [
                    { $eq: ['$$this.type', 'debit'] },
                    { $eq: ['$$this.status', 'completed'] }
                  ]},
                  { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] },
                  '$$value'
                ]
              }
            }
          }
        ]
      },
      availableBalance: {
        $max: [
          0,
          {
            $subtract: [
              '$balance',
              {
                $sum: [
                  {
                    $reduce: {
                      input: { $ifNull: ['$transactions', []] },
                      initialValue: 0,
                      in: {
                        $cond: [
                          { $and: [
                            { $eq: ['$$this.type', 'debit'] },
                            { $eq: ['$$this.status', 'pending'] }
                          ]},
                          { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] },
                          '$$value'
                        ]
                      }
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  }
])
```

---

## Verification Queries

```javascript
// Check total migrated wallets
db.wallets.countDocuments({ availableBalance: { $exists: true } })

// Find wallets with inconsistent available balance
db.wallets.aggregate([
  {
    $addFields: {
      calculatedAvailable: {
        $max: [
          0,
          {
            $subtract: [
              '$balance',
              {
                $reduce: {
                  input: { $ifNull: ['$transactions', []] },
                  initialValue: 0,
                  in: { ... }  // pending sum logic
                }
              }
            ]
          }
        ]
      }
    }
  },
  {
    $match: {
      $expr: { $ne: ['$availableBalance', '$calculatedAvailable'] }
    }
  }
])

// Check wallets with pending withdrawals
db.wallets.find({ totalPendingWithdrawals: { $gt: 0 } }).count()

// Total pending across platform
db.wallets.aggregate([
  { $group: { _id: null, total: { $sum: '$totalPendingWithdrawals' } } }
])
```

---

**Last Updated**: March 14, 2026  
**Compatibility**: MongoDB 4.0+, Mongoose 5.0+

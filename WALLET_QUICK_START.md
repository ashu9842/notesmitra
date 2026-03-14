# WALLET FIX - QUICK START GUIDE

## 🚀 Quick Deployment (3 Steps)

### Step 1: Deploy Code
```bash
cd c:\Users\ashut\Downloads\Notes

# Verify changes
git status

# Stage all changes
git add server/models/Wallet.js \
        server/controllers/walletController.js \
        server/controllers/razorpayController.js \
        server/services/paymentService.js \
        server/scripts/migrateWalletBalance.js \
        server/scripts/verifyWalletConsistency.js

# Commit
git commit -m "fix(wallet): add available balance tracking for platform and seller wallets"

# Push
git push origin main
```

### Step 2: Verify Existing Data
```bash
# Check current wallet state
node server/scripts/verifyWalletConsistency.js
```

**Expected Output:**
```
✅ Database connected
📊 Verifying X wallets...
✅ Checked 10/X wallets
...

📋 VERIFICATION REPORT
════════════════════════════════════════════════════════════════════════════════

⚠️ MISSING availableBalance (X wallets):
   - User: John Seller (5f3b...d1a)
   - User: Jane Platform (5f3c...e2b)
   ... and X more

📊 SUMMARY:
   Total Wallets: X
   Missing availableBalance: X
   Missing totalWithdrawn: X
   Missing totalPendingWithdrawals: X
   
⚠️ Total issues found: X
   Run migrateWalletBalance.js to fix missing fields
```

### Step 3: Migrate Data (if needed)
```bash
# Run migration
node server/scripts/migrateWalletBalance.js
```

**Expected Output:**
```
🔄 Starting wallet migration...
✅ Database connected
📊 Found 250 wallets to migrate
✅ Migrated 10/250 wallets
✅ Migrated 20/250 wallets
...
✅ Migrated 250/250 wallets

📈 Migration completed!
✅ Successfully migrated: 250 wallets
❌ Failed: 0 wallets
🎉 All wallets migrated successfully!
```

### Step 4: Verify Again
```bash
# Check if migration successful
node server/scripts/verifyWalletConsistency.js
```

**Expected Output:**
```
🔄 Starting wallet consistency verification...
✅ Database connected
📊 Verifying 250 wallets
...

📋 VERIFICATION REPORT
════════════════════════════════════════════════════════════════════════════════

⏳ PENDING WITHDRAWALS (5 wallets):
   - User: John Seller, Count: 2, Total: ₹800
   - User: Jane Seller, Count: 1, Total: ₹500
   📊 Total pending across all users: ₹1300

════════════════════════════════════════════════════════════════════════════════

📊 SUMMARY:
   Total Wallets: 250
   Missing availableBalance: 0 ✅
   Missing totalWithdrawn: 0 ✅
   Missing totalPendingWithdrawals: 0 ✅
   Incorrect availableBalance: 0 ✅
   Mismatched balances: 0 ✅
   Wallets with pending withdrawals: 5
   
✅ All wallets are consistent! No issues found.
```

---

## 📋 API Testing

### Test 1: Get Wallet with Available Balance
```bash
curl -X GET http://localhost:5000/api/wallet \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "wallet": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "balance": 1000,
    "availableBalance": 850,
    "totalWithdrawn": 100,
    "totalPendingWithdrawals": 50,
    "transactions": [ ... ]
  },
  "withdrawableBalance": 850
}
```

### Test 2: Request Withdrawal
```bash
curl -X POST http://localhost:5000/api/wallet/withdraw \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "method": "9876543210@paytm"
  }'
```

**Response:**
```json
{
  "success": true,
  "wallet": {
    "balance": 500,
    "availableBalance": 0,
    "totalWithdrawn": 100,
    "totalPendingWithdrawals": 500
  },
  "transaction": {
    "id": "txn_12345",
    "type": "debit",
    "amount": 500,
    "status": "pending",
    "timestamp": "2026-03-14T10:30:00Z"
  },
  "message": "Withdrawal request submitted..."
}
```

### Test 3: Admin Completes Withdrawal
```bash
curl -X POST http://localhost:5000/api/wallet/admin/complete-withdrawal \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "walletId": "507f1f77bcf86cd799439011",
    "txnId": "txn_12345"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Withdrawal marked as completed"
}
```

**Verify with GET /api/wallet:**
```json
{
  "success": true,
  "wallet": {
    "balance": 500,
    "availableBalance": 500,
    "totalWithdrawn": 600,
    "totalPendingWithdrawals": 0
  }
}
```

---

## 📊 Database Query Examples

### Check Total Pending Platform-Wide
```javascript
// In MongoDB console or via driver
db.wallets.aggregate([
  { $match: { totalPendingWithdrawals: { $gt: 0 } } },
  { $group: { 
    _id: null, 
    count: { $sum: 1 },
    totalPending: { $sum: '$totalPendingWithdrawals' }
  }}
])
```

**Output:**
```
{ _id: null, count: 5, totalPending: 1300 }
```

### Find Sellers with Available Balance
```javascript
db.wallets.find(
  { availableBalance: { $gt: 0 } },
  { userId: 1, balance: 1, availableBalance: 1, totalWithdrawn: 1 }
)
```

### Check Wallet Consistency
```javascript
db.wallets.find()
  .map(w => ({
    userId: w.userId,
    balance: w.balance,
    calcPending: w.transactions
      .filter(t => t.type === 'debit' && t.status === 'pending')
      .reduce((sum, t) => sum + t.amount, 0),
    storedPending: w.totalPendingWithdrawals,
    calcAvailable: Math.max(0, w.balance - 
      w.transactions
        .filter(t => t.type === 'debit' && t.status === 'pending')
        .reduce((sum, t) => sum + t.amount, 0)
    ),
    storedAvailable: w.availableBalance
  }))
  .filter(r => r.calcAvailable !== r.storedAvailable)
```

---

## 🔧 Troubleshooting Commands

### Check Node.js Module Cache Issue
```bash
# Clear Node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Restart server
npm start
```

### Check Database Connection
```bash
# Run verification script with debug
DEBUG=* node server/scripts/verifyWalletConsistency.js
```

### Check Specific Wallet
```javascript
// In MongoDB console
db.wallets.findOne({ userId: ObjectId("USER_ID") })
```

### Count Total Issues
```javascript
db.wallets.find({ availableBalance: { $exists: false } }).count()
```

---

## ✅ Pre-Launch Checklist

- [ ] Review WALLET_FIX_SUMMARY.md
- [ ] Review WALLET_FLOW_DIAGRAMS.md
- [ ] Deploy code to main branch
- [ ] Run verifyWalletConsistency.js
- [ ] If issues found, run migrateWalletBalance.js
- [ ] Run verification again
- [ ] Test 3 API scenarios above
- [ ] Monitor server logs for 1 hour
- [ ] Check database for consistency

---

## ⏱️ Timing

| Task | Estimated Time |
|------|-----------------|
| Code Review | 10 min |
| Code Deployment | 5 min |
| Data Verification | 2 min |
| Migration (small DB) | 5 min |
| Final Verification | 2 min |
| API Testing | 10 min |
| **Total** | **~35 min** |

---

## 📞 Support

If you encounter issues:

1. **Check verification output**
   ```bash
   node server/scripts/verifyWalletConsistency.js
   ```

2. **Review logs**
   ```bash
   tail -100 server/logs/combined.log
   ```

3. **Check specific wallet**
   ```javascript
   db.wallets.findOne({ userId: ObjectId("ID") })
   ```

4. **Re-run migration**
   ```bash
   node server/scripts/migrateWalletBalance.js
   ```

---

## 🎯 Success Indicators

✅ Verification script shows "All wallets are consistent"
✅ GET /api/wallet returns availableBalance field
✅ Withdrawal workflow: request → pending → complete works
✅ Platform wallet shows available balance
✅ No errors in server logs
✅ Database queries execute without errors

---

**Ready to Deploy?** Follow the 4 steps at the top of this guide!

Last Updated: March 14, 2026

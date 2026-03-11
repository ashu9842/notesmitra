# 🎓 NotesMitra - Learn Smarter Together

A comprehensive notes marketplace platform where sellers upload study notes that go through automated quality checks and admin review, with complete workflow from upload to purchase including Razorpay payment processing, escrow system, and wallet management.

## 🚀 Tech Stack

### Frontend
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Radix UI** for accessible components
- **Razorpay** for payments

### Backend
- **Node.js** + **Express** - REST API
- **MongoDB** + **Mongoose** - Database
- **JWT (Access + Refresh)** - Authentication
- **Razorpay** - Payment gateway
- **Multer** - File uploads

---

## ✨ Key Features

### For Buyers
- 🔍 Browse and search study notes
- 💳 Purchase notes with Razorpay or wallet
- 📥 Download purchased notes
- 💰 Manage wallet balance
- 🎫 Create support tickets

### For Sellers
- 📤 Upload study notes (PDF, min 3 pages)
- ✅ Automated quality checks
- 📊 Track sales and earnings
- 💸 Withdraw earnings
- 📈 View analytics

### For Admins
- 👨‍💼 Review uploaded notes (approve/reject)
- 📊 Platform statistics dashboard
- 👥 User management
- 🎫 Support ticket management
- 💰 Platform revenue tracking

### Core Features
- 🔐 **JWT Authentication** with Access + Refresh tokens
- 💳 **Razorpay Integration** for secure payments
- 💰 **Wallet System** with transaction history
- 🔄 **Role Switching** (buyer/seller/admin)
- 📊 **Quality Checks** (page count, file size, format)
- 💸 **Payment Structure**: 
  - Buyers pay: Note price + 2% platform fee
  - Sellers receive: 80% of note price
  - Platform: 18% service + 2% transaction fee

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 6+
- Razorpay account (for payments)

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd notesmitra
```

### 2. Backend Setup

```bash
# Navigate to server
cd server

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secrets, and Razorpay keys

# Start MongoDB
brew services start mongodb-community  # macOS
# or
sudo systemctl start mongod  # Linux

# Seed database with sample data
npm run seed

# Start backend server
npm run dev
```

Backend runs on: **http://localhost:5000**

### 3. Frontend Setup

```bash
# Create Next.js project
npx create-next-app@latest notesmitra-frontend --typescript --tailwind --app

# Navigate to frontend
cd notesmitra-frontend

# Install dependencies
npm install axios razorpay @radix-ui/react-dialog lucide-react

# Configure environment
echo "NEXT_PUBLIC_API_URL=http://localhost:5000/api" > .env.local
echo "NEXT_PUBLIC_RAZORPAY_KEY=your_razorpay_key_id" >> .env.local

# Start frontend server
npm run dev
```

Frontend runs on: **http://localhost:3000**

---

## 🔐 Authentication

### JWT with Refresh Tokens

- **Access Token**: 15 minutes (used for API requests)
- **Refresh Token**: 7 days (used to get new access token)
- Automatic token refresh on expiry
- Secure token storage

### Sample Credentials (after seeding)

```
Admin:
  Email: admin@notesmitra.com
  Password: Admin@123

Seller:
  Email: john@example.com
  Password: Password@123

Buyer:
  Email: bob@example.com
  Password: Password@123
```

---

## 💳 Razorpay Integration

### Setup Razorpay

1. Sign up at [Razorpay Dashboard](https://dashboard.razorpay.com)
2. Get **Test Mode** API Keys
3. Add to backend `.env`:
   ```env
   RAZORPAY_KEY_ID=your_key_id
   RAZORPAY_KEY_SECRET=your_key_secret
   ```
4. Add Key ID to frontend `.env.local`:
   ```env
   NEXT_PUBLIC_RAZORPAY_KEY=your_key_id
   ```

### Payment Features

- ✅ Wallet recharge via Razorpay
- ✅ Note purchase via Razorpay
- ✅ Payment verification
- ✅ Secure webhook handling
- ✅ Test mode support

### Test Payment

- **Card**: 4111 1111 1111 1111
- **Expiry**: Any future date
- **CVV**: Any 3 digits

---

## 📊 API Endpoints

### Authentication
```
POST   /api/auth/signup           # Register
POST   /api/auth/signin           # Login
POST   /api/auth/refresh          # Refresh token
POST   /api/auth/logout           # Logout
GET    /api/auth/profile          # Get profile
```

### Notes
```
POST   /api/notes/upload          # Upload note
GET    /api/notes                 # Browse notes
GET    /api/notes/:id             # Get note details
GET    /api/notes/:id/download    # Download note
```

### Payments & Wallet
```
GET    /api/wallet                # Get wallet
POST   /api/wallet/add-funds      # Add funds
POST   /api/payments/purchase     # Purchase note
```

### Razorpay
```
GET    /api/razorpay/key                     # Get key
POST   /api/razorpay/create-order/wallet     # Create wallet order
POST   /api/razorpay/verify-payment/wallet   # Verify wallet payment
POST   /api/razorpay/create-order/note       # Create note order
POST   /api/razorpay/verify-payment/note     # Verify note payment
```

### Admin
```
GET    /api/admin/stats           # Platform stats
POST   /api/notes/:id/review      # Review note
GET    /api/admin/users           # Manage users
```

---

## 🗄️ Database Schema

### Collections

1. **users** - User accounts (buyers, sellers, admins)
2. **refreshtokens** - JWT refresh tokens
3. **notes** - Study notes with metadata
4. **wallets** - User wallets with transaction history
5. **purchases** - Purchase records
6. **tickets** - Support tickets

### Sample Data (After Seeding)

- 5 users (1 admin, 2 sellers, 2 buyers)
- 20 notes across various subjects
- 10 purchases
- 8 support tickets
- Wallet transactions

---

## 📁 Project Structure

```
notesmitra/
├── server/                      # Backend (Node.js + Express)
│   ├── config/                  # Database configuration
│   ├── controllers/             # Business logic
│   │   ├── authController.js    # JWT auth with refresh tokens
│   │   ├── razorpayController.js # Razorpay integration
│   │   ├── noteController.js
│   │   ├── walletController.js
│   │   └── ...
│   ├── models/                  # MongoDB schemas
│   │   ├── User.js
│   │   ├── RefreshToken.js
│   │   ├── Note.js
│   │   ├── Wallet.js
│   │   └── ...
│   ├── routes/                  # API routes
│   ├── middleware/              # Auth, upload, error handling
│   ├── scripts/
│   │   └── seed.js              # Database seeding
│   ├── uploads/                 # File storage
│   └── server.js                # Express server
│
├── notesmitra-frontend/         # Frontend (Next.js 14)
│   ├── app/                     # App Router
│   ├── components/              # React components
│   ├── lib/                     # Utilities
│   └── public/                  # Static assets
│
└── docs/                        # Documentation
    ├── NEXTJS_MERN_GUIDE.md     # Complete guide
    ├── BACKEND_COMPARISON.md    # Tech comparison
    └── MIGRATION_GUIDE.md       # Migration guides
```

---

## 🧪 Testing

### Test Backend API

```bash
# Health check
curl http://localhost:5000/health

# Sign up
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@123","name":"Test User"}'

# Sign in
curl -X POST http://localhost:5000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@123"}'

# Get notes
curl http://localhost:5000/api/notes
```

---

## 🚀 Deployment

### Backend (Railway/Render/Heroku)

1. Create project
2. Connect GitHub repo
3. Add MongoDB database
4. Set environment variables
5. Deploy

### Frontend (Vercel)

1. Import GitHub repo
2. Configure Next.js settings
3. Add environment variables
4. Deploy

---

## 📚 Documentation

- [**NEXTJS_MERN_GUIDE.md**](/NEXTJS_MERN_GUIDE.md) - Complete setup guide
- [**BACKEND_COMPARISON.md**](/BACKEND_COMPARISON.md) - Tech stack comparison
- [**MIGRATION_GUIDE.md**](/MIGRATION_GUIDE.md) - Migration guides

---

## 🆘 Troubleshooting

### MongoDB Connection Error
```bash
# Start MongoDB
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### JWT Token Expired
- Use refresh token endpoint: `POST /api/auth/refresh`
- Or login again

### Razorpay Payment Failed
- Check API keys in `.env`
- Ensure keys match dashboard
- Use test card for testing

---

## 📝 Features Roadmap

- [x] JWT with refresh tokens
- [x] Razorpay payment integration
- [x] Database seeding
- [x] Next.js 14 App Router
- [ ] Email notifications
- [ ] Advanced search filters
- [ ] Note preview
- [ ] Reviews and ratings
- [ ] Social authentication
- [ ] Mobile app

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

---

## 📄 License

MIT License - feel free to use for learning and projects.

---

## 💡 Key Highlights

✅ **Production-Ready** - Complete backend with security
✅ **Modern Stack** - Next.js 14 + MERN
✅ **Real Payments** - Razorpay integration
✅ **Secure Auth** - JWT with refresh tokens
✅ **Sample Data** - Ready-to-use seed data
✅ **Well-Documented** - Comprehensive guides
✅ **Scalable** - MongoDB + Express architecture

---

## 📞 Support

For questions or issues:
- Check documentation in `/docs`
- Review troubleshooting guide
- Open GitHub issue

---

**Built with ❤️ for students, by students**

**NotesMitra - Learn Smarter Together** 🎓

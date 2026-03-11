# NotesMitra Backend (MERN Stack)

Complete backend API for NotesMitra notes marketplace platform.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Start development server
npm run dev

# Start production server
npm start
```

## 📦 Tech Stack

- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **JWT** - Authentication
- **Multer** - File uploads
- **bcrypt** - Password hashing

## 🔐 Environment Variables

Required in `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/notesmitra
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173
MAX_FILE_SIZE=52428800
UPLOAD_PATH=./uploads
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register
- `POST /api/auth/signin` - Login
- `GET /api/auth/profile` - Get profile

### Notes
- `POST /api/notes/upload` - Upload note
- `GET /api/notes` - Get all notes
- `GET /api/notes/:id` - Get note
- `POST /api/notes/:id/review` - Review (Admin)
- `GET /api/notes/:id/download` - Download

### Wallet
- `GET /api/wallet` - Get wallet
- `POST /api/wallet/add-funds` - Add funds
- `POST /api/wallet/withdraw` - Withdraw

### Payments
- `POST /api/payments/purchase` - Purchase note
- `GET /api/payments/purchases` - Get purchases

### Support
- `POST /api/tickets` - Create ticket
- `GET /api/tickets` - Get tickets
- `POST /api/tickets/:id/reply` - Reply

### Admin
- `GET /api/admin/stats` - Platform stats
- `GET /api/admin/users` - Get users

## 🛡️ Security

- JWT authentication
- Password hashing (bcrypt)
- Rate limiting
- Input sanitization
- CORS protection
- Security headers (Helmet)

## 📊 Database Models

- **User** - User accounts
- **Note** - Study notes
- **Wallet** - User wallets
- **Purchase** - Purchase records
- **Ticket** - Support tickets

## 📖 Documentation

See [MERN_BACKEND_GUIDE.md](/MERN_BACKEND_GUIDE.md) for complete documentation.

## 🚀 Deployment

Compatible with:
- Heroku
- Railway
- Render
- DigitalOcean
- AWS EC2
- Any Node.js hosting

## 📞 Support

For issues or questions, check the documentation or open an issue.

---

**Built with ❤️ for NotesMitra**

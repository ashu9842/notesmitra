/**
 * Create Admin User Script
 * Creates a default admin user for NotesMitra platform
 * 
 * Usage: node scripts/create-admin.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Institution from '../models/Institution.js';
import Wallet from '../models/Wallet.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Load environment variables
dotenv.config();

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('✅ MongoDB Connected for admin creation');
  } catch (error) {
    logger.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

// Create admin user
const createAdmin = async () => {
  try {
    console.log('\n📝 Creating Admin User for NotesMitra...\n');

    // Get or create NotesMitra institution
    let institution = await Institution.findOne({ slug: 'notesmitra' });
    
    if (!institution) {
      console.log('Creating NotesMitra institution...');
      institution = await Institution.create({
        name: 'NotesMitra',
        slug: 'notesmitra',
        plan: 'premium',
        maxUsers: 10000,
        storageLimit: 1000,
        isActive: true
      });
      console.log('✅ Institution created');
    } else {
      console.log('✅ Institution found');
    }

    // Default admin credentials
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@notesmitra.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
    const adminName = 'NotesMitra Admin';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      email: adminEmail,
      role: 'admin'
    });

    if (existingAdmin) {
      console.log(`⚠️  Admin user already exists with email: ${adminEmail}`);
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create admin user
    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      role: 'admin',
      tenantId: institution._id,
      isTenantAdmin: true,
      isActive: true,
      emailVerified: true
    });

    console.log('✅ Admin user created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Admin Email:', adminEmail);
    console.log('🔐 Admin Password:', adminPassword);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('⚠️  IMPORTANT:');
    console.log('1. Change this password after first login!');
    console.log('2. Store these credentials securely');
    console.log('3. Never commit to version control\n');

    // Create wallet for admin
    const existingWallet = await Wallet.findOne({ userId: admin._id });
    if (!existingWallet) {
      await Wallet.create({
        userId: admin._id,
        tenantId: institution._id,
        balance: 0,
        transactions: []
      });
      console.log('✅ Wallet created for admin\n');
    }

    console.log('✅ Admin setup complete!');
    console.log('Admin can now login at: http://localhost:5173\n');

  } catch (error) {
    logger.error('❌ Error creating admin:', error.message);
    console.error(error);
    process.exit(1);
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await createAdmin();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Failed to create admin:', error);
    process.exit(1);
  }
};

main();

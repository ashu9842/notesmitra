import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Note from '../models/Note.js';
import Wallet from '../models/Wallet.js';
import Purchase from '../models/Purchase.js';
import Ticket from '../models/Ticket.js';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';

// Load environment variables
dotenv.config();

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

// Demo data functions removed - working with real data only

// Clear database
const clearDatabase = async () => {
  try {
    await User.deleteMany({});
    await Note.deleteMany({});
    await Wallet.deleteMany({});
    await Purchase.deleteMany({});
    await Ticket.deleteMany({});
    console.log('🗑️  Database cleared');
  } catch (error) {
    console.error('Error clearing database:', error);
  }
};

// Seed functions removed - working with real data only

// Main script: Clear demo/sample data
const seedDatabase = async () => {
  try {
    console.log('🧹 Clearing database of any remaining demo/sample data...');
    // Connect to database
    await connectDB();

    // Clear existing demo data
    await clearDatabase();

    console.log('✅ Database cleared. Ready for real data.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
};

// Run cleaner
seedDatabase();

import mongoose from 'mongoose';

const dbUrl = 'mongodb+srv://notesmitra:notesmitra123@cluster0.4wffb.mongodb.net/notesmitra';

const dropWalletsCollection = async () => {
  try {
    await mongoose.connect(dbUrl, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');
    
    // Drop wallets collection
    await mongoose.connection.db.dropCollection('wallets').catch(() => {
      console.log('Wallets collection not found or already empty');
    });
    
    console.log('✅ Wallets collection dropped successfully');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

dropWalletsCollection();

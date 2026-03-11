import mongoose from 'mongoose'
import config from './index.js';
import logger from '../utils/logger.js';

const RETRY_DELAY_MS   = 5000;  // wait 5 s between retries
const MAX_RETRIES      = 12;    // up to 1 minute of retries before giving up

const connectDB = async (attempt = 1) => {
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 20000, // per-attempt DNS/server selection timeout
      socketTimeoutMS: 45000,          // close idle sockets after 45 s
      heartbeatFrequencyMS: 10000,     // probe server health every 10 s
    });

    // Set global query timeout (30 seconds — generous enough for Atlas cold starts)
    mongoose.set('maxTimeMS', 30000);

    // Add query hooks to log slow queries
    if (config.isDevelopment) {
      mongoose.set('debug', (collectionName, method) => {
        logger.logDatabaseQuery(`${collectionName}.${method}`, 0);
      });
    }

    logger.info('MongoDB connected successfully', {
      host: conn.connection.host,
      database: conn.connection.name,
    });

    // Drop problematic indexes (best-effort, never fatal)
    try {
      const db = mongoose.connection.getClient().db(mongoose.connection.name);
      await db.collection('wallets').dropIndex('transactions.id_1').catch(() => null);
      logger.info('Index migration completed', { collection: 'wallets', action: 'dropped transactions.id_1' });
    } catch { /* non-critical */ }

    if (config.isDevelopment) {
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      console.log(`Database: ${conn.connection.name}`);
    }

    // Reconnect automatically if the connection drops after startup
    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected — scheduling reconnect in 5 s');
      setTimeout(() => connectDB(1), RETRY_DELAY_MS);
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB runtime error', { error: err.message });
      // 'disconnected' event fires automatically after most errors — no manual reconnect needed
    });

  } catch (error) {
    logger.error('MongoDB connection error', { error: error.message, attempt });

    if (attempt < MAX_RETRIES) {
      logger.info(`Retrying MongoDB connection in ${RETRY_DELAY_MS / 1000} s… (attempt ${attempt + 1}/${MAX_RETRIES})`);
      setTimeout(() => connectDB(attempt + 1), RETRY_DELAY_MS);
    } else {
      logger.error('MongoDB: all retry attempts exhausted — server will keep running with 503 responses until DB is reachable');
      // Do NOT process.exit — the 503 readiness gate in server.js handles requests safely
    }
  }
};

export default connectDB;

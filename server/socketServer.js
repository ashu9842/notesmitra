/**
 * Socket.IO Server Configuration with Room-Based Architecture & Redis Adapter
 * 
 * Room Structure:
 * - user:{userId} - Individual user notifications
 * - admin - All admin notifications (broadcasted)
 * - seller:{userId} - Seller-specific notifications (purchase alerts)
 * 
 * Redis Adapter enables:
 * - Pub/sub across multiple server instances
 * - Room-based message routing
 * - Sticky sessions support
 */

import { setupSocketIORedisAdapter, getRedisPublisher, getRedisSubscriber } from './config/redis.js';
import logger from './utils/logger.js';

/**
 * Initialize Socket.IO with room management and Redis adapter
 * @param {Server} io - Socket.IO server instance
 */
export const initializeSocketServer = async (io) => {
  // Setup Redis adapter for multi-instance support
  try {
    await setupSocketIORedisAdapter(io);
  } catch (error) {
    logger.warn('Redis adapter setup failed, Socket.IO will work in single-instance mode');
  }
  // Apply auth guard to all socket events
  io.on('connection', (socket) => {
    const userId = socket.user?._id;
    const userEmail = socket.user?.email;
    const userRole = socket.user?.role;

    logger.debug(`Socket connected: ${userEmail}`);

    // STEP 1: Join user-specific room
    socket.join(`user:${userId}`);
    logger.debug(`User joined room: user`);

    // STEP 2: Join role-specific rooms
    if (userRole === 'admin') {
      socket.join('admin');
      logger.debug('Admin joined room');
    }

    if (userRole === 'seller') {
      socket.join(`seller:${userId}`);
      logger.debug('Seller joined room');
    }

    // STEP 3: Send Welcome event to user
    socket.emit('socket:connected', {
      userId,
      userEmail,
      userRole,
      timestamp: new Date(),
      message: 'Connected to NotesMitra real-time server'
    });

    // STEP 4: Listen for explicit room joins (if frontend sends)
    socket.on('room:join', (roomData) => {
      const { room } = roomData;
      if (room && typeof room === 'string') {
        socket.join(room);
        logger.debug(`User joined room: ${room}`);
      }
    });

    // STEP 5: Listen for explicit room leaves
    socket.on('room:leave', (roomData) => {
      const { room } = roomData;
      if (room && typeof room === 'string') {
        socket.leave(room);
        logger.debug(`User left room: ${room}`);
      }
    });

    // STEP 6: Disconnect handler
    socket.on('disconnect', (reason) => {
      logger.debug(`Socket disconnected: ${userEmail} (Reason: ${reason})`);
    });

    // STEP 7: Error handler
    socket.on('error', (error) => {
      logger.error(`Socket error (${userEmail}):`, error.message);
    });
  });

  return io;
};

/**
 * Emit event to a specific user
 * @param {Server} io - Socket.IO server instance
 * @param {string} userId - Target user ID
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
export const emitToUser = (io, userId, event, data) => {
  try {
    const room = `user:${userId}`;
    io.to(room).emit(event, {
      ...data,
      timestamp: new Date()
    });
    logger.debug(`Event emitted to user`);
  } catch (error) {
    logger.error(`Error emitting to user:`, error.message);
  }
};

/**
 * Emit event to all admins
 * @param {Server} io - Socket.IO server instance
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
export const emitToAdmins = (io, event, data) => {
  try {
    io.to('admin').emit(event, {
      ...data,
      timestamp: new Date()
    });
    logger.debug(`Event emitted to admin`);
  } catch (error) {
    logger.error(`Error emitting to admins:`, error.message);
  }
};

/**
 * Emit event to a specific seller
 * @param {Server} io - Socket.IO server instance
 * @param {string} sellerId - Target seller ID
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
export const emitToSeller = (io, sellerId, event, data) => {
  try {
    const room = `seller:${sellerId}`;
    io.to(room).emit(event, {
      ...data,
      timestamp: new Date()
    });
    logger.debug(`Event emitted to seller`);
  } catch (error) {
    logger.error(`Error emitting to seller:`, error.message);
  }
};

/**
 * Broadcast event to everyone
 * @param {Server} io - Socket.IO server instance
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
export const broadcastEvent = (io, event, data) => {
  try {
    io.emit(event, {
      ...data,
      timestamp: new Date()
    });
    logger.debug(`Event broadcasted to all clients`);
  } catch (error) {
    logger.error(`Error broadcasting event:`, error.message);
  }
};

/**
 * Get room name for a user
 * @param {string} userId - User ID
 * @returns {string} - Room name
 */
export const getUserRoom = (userId) => `user:${userId}`;

/**
 * Get admin room name
 * @returns {string} - Admin room name
 */
export const getAdminRoom = () => 'admin';

/**
 * Get seller room name
 * @param {string} sellerId - Seller ID
 * @returns {string} - Room name
 */
export const getSellerRoom = (sellerId) => `seller:${sellerId}`;

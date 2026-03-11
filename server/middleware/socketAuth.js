import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/index.js';
import { AUTH_COOKIES } from '../config/constants.js';
import logger from '../utils/logger.js';

const ACCESS_TOKEN_NAME = process.env.ACCESS_TOKEN_NAME || AUTH_COOKIES.ACCESS;

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
};

/**
 * Socket.io authentication middleware
 * Validates JWT from handshake auth token
 * Rejects connections if token is invalid, expired, or user is inactive
 */
export const socketAuthMiddleware = async (socket, next) => {
  try {
    const authToken = socket.handshake.auth?.token;
    const cookieHeader = socket.handshake.headers?.cookie;
    const cookies = parseCookies(cookieHeader);
    const token = authToken || cookies[ACCESS_TOKEN_NAME];

    // Check if token exists
    if (!token) {
      logger.warn('Socket connection denied: No token provided');
      return next(new Error('Authentication required: No token provided'));
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtAccessSecret);
    } catch (error) {
      logger.warn(`Socket authentication failed: ${error.message}`);
      if (error.name === 'TokenExpiredError') {
        return next(new Error('Authentication failed: Token expired'));
      }
      return next(new Error('Authentication failed: Invalid token'));
    }

    // Fetch user from database
    const user = await User.findById(decoded.id);

    if (!user) {
      logger.warn(`Socket connection denied: User not found (ID: ${decoded.id})`);
      return next(new Error('Authentication failed: User not found'));
    }

    // Verify user is active
    if (!user.isActive) {
      logger.warn(`Socket connection denied: User inactive (ID: ${decoded.id})`);
      return next(new Error('Authentication failed: User account is inactive'));
    }

    // Attach user info to socket for use in event handlers
    socket.userId = user._id;
    socket.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role
    };

    logger.debug(`Socket authenticated: User ${user.email} (ID: ${user._id})`);
    next();
  } catch (error) {
    logger.error('Socket auth middleware error:', error.message);
    next(new Error('Authentication error: Internal server error'));
  }
};

/**
 * Middleware to disconnect unauthenticated sockets
 * Use as .use() after socketAuthMiddleware to enforce auth on all events
 */
export const socketAuthGuard = (socket, next) => {
  if (!socket.userId) {
    logger.warn('Socket event rejected: User not authenticated');
    return next(new Error('Unauthenticated access'));
  }
  next();
};

export default socketAuthMiddleware;

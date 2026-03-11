import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/index.js';

const ACCESS_COOKIE_NAME = 'accessToken';

const parseCookies = (cookieHeader) => {
  if (!cookieHeader) return {};

  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...valueParts] = part.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(valueParts.join('=') || '');
    return acc;
  }, {});
};

export const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in cookies
    const cookies = parseCookies(req.headers.cookie);
    token = cookies[ACCESS_COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token with ACCESS SECRET
      const decoded = jwt.verify(token, config.jwtAccessSecret);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      if (!req.user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'User account is deactivated'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Token is invalid or expired'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Server error in authentication'
    });
  }
};

// Middleware to check user role
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

// Middleware to check if user is superadmin
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }

  if (!req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Superadmin privileges required.'
    });
  }

  next();
};
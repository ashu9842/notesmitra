/**
 * Production-Safe Environment Configuration System
 * Validates and loads environment-specific configuration
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isDevelopment = NODE_ENV === 'development';
const isTest = NODE_ENV === 'test';

// Load appropriate .env file
const envFile = isProduction ? '.env.production' : isTest ? '.env.test' : '.env';
dotenv.config({ path: join(__dirname, '..', envFile) });

// Environment variable schema with validation rules
const envSchema = {
  // Critical secrets - MUST be present in production
  critical: {
    JWT_ACCESS_SECRET: {
      required: true,
      validate: (val) => val && val.length >= 32,
      errorMsg: 'JWT_ACCESS_SECRET must be at least 32 characters long'
    },
    JWT_REFRESH_SECRET: {
      required: isProduction,
      default: process.env.JWT_ACCESS_SECRET || 'dev-refresh-secret',
      validate: (val) => !isProduction || (val && val.length >= 32),
      errorMsg: 'JWT_REFRESH_SECRET must be at least 32 characters in production'
    },
    MONGODB_URI: {
      required: true,
      aliases: ['MONGO_URI'],
      validate: (val) => val && (val.startsWith('mongodb://') || val.startsWith('mongodb+srv://')),
      errorMsg: 'MONGODB_URI must be a valid MongoDB connection string'
    }
  },

  // Application config
  app: {
    NODE_ENV: {
      required: false,
      default: 'development',
      validate: (val) => ['development', 'test', 'production'].includes(val),
      errorMsg: 'NODE_ENV must be development, test, or production'
    },
    PORT: {
      required: false,
      default: 5000,
      transform: (val) => parseInt(val, 10),
      validate: (val) => !isNaN(val) && val > 0 && val < 65536,
      errorMsg: 'PORT must be a valid port number (1-65535)'
    },
    CLIENT_URL: {
      required: false,
      default: isDevelopment ? 'http://localhost:5173' : 'http://localhost:3000',
      validate: (val) => val && (val.startsWith('http://') || val.startsWith('https://')),
      errorMsg: 'CLIENT_URL must be a valid URL'
    }
  },

  // JWT Configuration
  jwt: {
    JWT_ACCESS_EXPIRE: {
      required: false,
      default: '2h',
      errorMsg: 'JWT_ACCESS_EXPIRE must be a valid time string'
    },
    JWT_REFRESH_EXPIRE: {
      required: false,
      default: '7d',
      errorMsg: 'JWT_REFRESH_EXPIRE must be a valid time string'
    }
  },

  // Redis Configuration
  redis: {
    REDIS_URL: {
      required: false,
      default: null,
      errorMsg: 'REDIS_URL must be a valid Redis connection string'
    },
    REDIS_ENABLED: {
      required: false,
      default: isProduction ? 'true' : 'false',
      transform: (val) => val === 'true' || val === true,
      errorMsg: 'REDIS_ENABLED must be true or false'
    }
  },

  // Payment Gateway
  payments: {
    RAZORPAY_KEY_ID: {
      required: isProduction,
      default: isDevelopment ? 'rzp_test_dummy' : null,
      errorMsg: 'RAZORPAY_KEY_ID is required in production'
    },
    RAZORPAY_KEY_SECRET: {
      required: isProduction,
      default: isDevelopment ? 'dummy_secret' : null,
      errorMsg: 'RAZORPAY_KEY_SECRET is required in production'
    },
    RAZORPAY_WEBHOOK_SECRET: {
      required: isProduction,
      default: isDevelopment ? 'webhook_secret' : null,
      errorMsg: 'RAZORPAY_WEBHOOK_SECRET is required in production'
    },
    RAZORPAY_ACCOUNT_NUMBER: {
      required: false,
      default: null,
      errorMsg: 'RAZORPAY_ACCOUNT_NUMBER is your Razorpay X current account number for payouts'
    },
    PLATFORM_FEE_PERCENT: {
      required: false,
      default: 2,
      transform: (val) => parseFloat(val),
      validate: (val) => !isNaN(val) && val >= 0 && val <= 100,
      errorMsg: 'PLATFORM_FEE_PERCENT must be between 0 and 100'
    },
    PLATFORM_USER_ID: {
      required: false,
      default: null,
      errorMsg: 'PLATFORM_USER_ID for commission collection'
    }
  },

  // File Upload
  upload: {
    UPLOAD_PATH: {
      required: false,
      default: './uploads',
      errorMsg: 'UPLOAD_PATH must be a valid directory path'
    },
    MAX_FILE_SIZE: {
      required: false,
      default: 52428800, // 50MB
      transform: (val) => parseInt(val, 10),
      validate: (val) => !isNaN(val) && val > 0,
      errorMsg: 'MAX_FILE_SIZE must be a positive number'
    }
  },

  // Cloudinary Configuration
  cloudinary: {
    CLOUDINARY_CLOUD_NAME: {
      required: isProduction,
      default: null,
      errorMsg: 'CLOUDINARY_CLOUD_NAME is required in production'
    },
    CLOUDINARY_API_KEY: {
      required: isProduction,
      default: null,
      errorMsg: 'CLOUDINARY_API_KEY is required in production'
    },
    CLOUDINARY_API_SECRET: {
      required: isProduction,
      default: null,
      validate: (val) => !isProduction || (val && val.length >= 20),
      errorMsg: 'CLOUDINARY_API_SECRET is required in production'
    },
    USE_CLOUDINARY: {
      required: false,
      default: isProduction ? 'true' : 'false',
      transform: (val) => val === 'true' || val === true,
      errorMsg: 'USE_CLOUDINARY must be true or false'
    }
  },

  // Security
  security: {
    CSRF_SECRET: {
      required: isProduction,
      default: isDevelopment ? 'dev-csrf-secret' : null,
      validate: (val) => !isProduction || (val && val.length >= 32),
      errorMsg: 'CSRF_SECRET must be at least 32 characters in production'
    },
    RATE_LIMIT_WINDOW_MS: {
      required: false,
      default: 900000, // 15 minutes
      transform: (val) => parseInt(val, 10),
      errorMsg: 'RATE_LIMIT_WINDOW_MS must be a number'
    },
    RATE_LIMIT_MAX_REQUESTS: {
      required: false,
      default: 100,
      transform: (val) => parseInt(val, 10),
      errorMsg: 'RATE_LIMIT_MAX_REQUESTS must be a number'
    }
  },

  // Groq AI (primary - free tier friendly)
  groq: {
    GROQ_API_KEY: {
      required: false,
      default: null,
      errorMsg: 'GROQ_API_KEY for AI summaries (free tier: 40K tokens/month)'
    }
  },

  // Gemini AI (fallback)
  gemini: {
    GEMINI_API_KEY: {
      required: false,
      default: null,
      errorMsg: 'GEMINI_API_KEY for AI-powered PDF quality checks'
    }
  },

  // Firebase Admin SDK (for verifying Google ID tokens)
  firebase: {
    FIREBASE_PROJECT_ID: {
      required: false,
      default: null,
      errorMsg: 'FIREBASE_PROJECT_ID for Firebase Admin SDK'
    },
    FIREBASE_CLIENT_EMAIL: {
      required: false,
      default: null,
      errorMsg: 'FIREBASE_CLIENT_EMAIL for Firebase Admin SDK service account'
    },
    FIREBASE_PRIVATE_KEY: {
      required: false,
      default: null,
      errorMsg: 'FIREBASE_PRIVATE_KEY for Firebase Admin SDK service account'
    }
  }
};

/**
 * Validate and load environment variable
 */
const loadEnvVar = (key, schema, category) => {
  // Check aliases
  let value = process.env[key];
  if (!value && schema.aliases) {
    for (const alias of schema.aliases) {
      if (process.env[alias]) {
        value = process.env[alias];
        break;
      }
    }
  }

  // Check if required
  if (schema.required && !value && schema.default === undefined) {
    throw new Error(
      `❌ FATAL: Missing required environment variable: ${key}\n   ${schema.errorMsg}\n   Environment: ${NODE_ENV}`
    );
  }

  // Use default if not provided
  if (!value) {
    value = schema.default;
  }

  // Transform value if transformer provided
  if (value !== null && value !== undefined && schema.transform) {
    value = schema.transform(value);
  }

  // Validate value
  if (value !== null && value !== undefined && schema.validate) {
    if (!schema.validate(value)) {
      throw new Error(
        `❌ FATAL: Invalid value for ${key}: "${value}"\n   ${schema.errorMsg}\n   Environment: ${NODE_ENV}`
      );
    }
  }

  return value;
};

/**
 * Load all environment variables
 */
const loadConfig = () => {
  const config = {
    env: {
      NODE_ENV,
      isProduction,
      isDevelopment,
      isTest
    }
  };

  const errors = [];

  try {
    // Load each category
    for (const [category, variables] of Object.entries(envSchema)) {
      config[category] = {};
      
      for (const [key, schema] of Object.entries(variables)) {
        try {
          config[category][key] = loadEnvVar(key, schema, category);
        } catch (error) {
          errors.push(error.message);
        }
      }
    }

    // If any critical errors, crash immediately
    if (errors.length > 0) {
      console.error('\n==========================================');
      console.error('❌ ENVIRONMENT CONFIGURATION ERRORS');
      console.error('==========================================\n');
      errors.forEach(err => console.error(err));
      console.error('\n==========================================');
      console.error('Server cannot start with invalid configuration.');
      console.error('Please fix the above errors and restart.');
      console.error('==========================================\n');
      process.exit(1);
    }

    // Create flattened config for backward compatibility
    const flatConfig = {
      // Environment
      env: NODE_ENV,
      isProduction,
      isDevelopment,
      isTest,
      
      // App
      port: config.app.PORT,
      clientUrl: config.app.CLIENT_URL,
      
      // Database
      mongoUri: config.critical.MONGODB_URI,
      
      // JWT
      jwtAccessSecret: config.critical.JWT_ACCESS_SECRET,
      jwtRefreshSecret: config.critical.JWT_REFRESH_SECRET,
      jwtAccessExpire: config.jwt.JWT_ACCESS_EXPIRE,
      jwtRefreshExpire: config.jwt.JWT_REFRESH_EXPIRE,
      
      // Redis
      redisUrl: config.redis.REDIS_URL,
      redisEnabled: config.redis.REDIS_ENABLED,
      
      // Payments
      razorpayKeyId: config.payments.RAZORPAY_KEY_ID,
      razorpayKeySecret: config.payments.RAZORPAY_KEY_SECRET,
      razorpayWebhookSecret: config.payments.RAZORPAY_WEBHOOK_SECRET,
      razorpayAccountNumber: config.payments.RAZORPAY_ACCOUNT_NUMBER,
      platformFeePercent: config.payments.PLATFORM_FEE_PERCENT,
      platformUserId: config.payments.PLATFORM_USER_ID,
      
      // Upload
      uploadPath: config.upload.UPLOAD_PATH,
      maxFileSize: config.upload.MAX_FILE_SIZE,
      
      // Cloudinary
      cloudinaryCloudName: config.cloudinary.CLOUDINARY_CLOUD_NAME,
      cloudinaryApiKey: config.cloudinary.CLOUDINARY_API_KEY,
      cloudinaryApiSecret: config.cloudinary.CLOUDINARY_API_SECRET,
      useCloudinary: config.cloudinary.USE_CLOUDINARY,
      
      // Security
      csrfSecret: config.security.CSRF_SECRET,
      rateLimitWindowMs: config.security.RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests: config.security.RATE_LIMIT_MAX_REQUESTS,

      // Gemini AI
      geminiApiKey: config.gemini.GEMINI_API_KEY,

      // Groq AI
      groqApiKey: config.groq.GROQ_API_KEY,

      // Firebase Admin SDK
      firebaseProjectId: config.firebase.FIREBASE_PROJECT_ID,
      firebaseClientEmail: config.firebase.FIREBASE_CLIENT_EMAIL,
      firebasePrivateKey: config.firebase.FIREBASE_PRIVATE_KEY,

      // Email (nodemailer / Gmail SMTP)
      emailUser: process.env.EMAIL_USER || '',
      emailPass: process.env.EMAIL_PASS || '',
    };

    return flatConfig;
  } catch (error) {
    console.error('❌ FATAL: Failed to load configuration:', error.message);
    process.exit(1);
  }
};

// Load and validate configuration
const config = loadConfig();

export default config;

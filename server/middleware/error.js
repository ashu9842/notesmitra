import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error with request context
  logger.logError(err, req);

  let statusCode = error.statusCode || 500;
  let code = error.code || 'UNKNOWN_ERROR';

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    statusCode = 404;
    code = 'VALIDATION_ERROR';
    error = { message, statusCode, code };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    error = { message, statusCode, code };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => {
      // Transform technical enum errors into user-friendly messages
      if (val.kind === 'enum' || val.message.includes('is not a valid enum value')) {
        return 'Please provide valid information for all fields';
      }
      // Return the custom error message from model
      return val.message;
    });
    const message = messages.join(', ');
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    error = { message, statusCode, code };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    statusCode = 401;
    code = 'AUTH_ERROR';
    error = { message, statusCode, code };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    statusCode = 401;
    code = 'AUTH_ERROR';
    error = { message, statusCode, code };
  }

  // MongoDB query timeout
  if (err.name === 'MongoServerError' && err.code === 50) {
    const message = 'Query took too long to execute. Please try again with more specific filters.';
    statusCode = 408;
    code = 'TIMEOUT_ERROR';
    error = { message, statusCode, code };
  }

  // MongoDB cursor timeout
  if (err.name === 'MongoError' && (err.code === 50 || err.message.includes('operation exceeded time limit'))) {
    const message = 'Database operation timed out. Please refine your query.';
    statusCode = 408;
    code = 'TIMEOUT_ERROR';
    error = { message, statusCode, code };
  }

  // Razorpay SDK errors — SDK throws { statusCode, error: { code, description } }
  if (err.error && err.error.description) {
    const description = err.error.description;
    statusCode = (typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600)
      ? err.statusCode
      : 422;
    code = err.error.code || 'PAYMENT_ERROR';
    error = { message: description, statusCode, code };
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const finalStatusCode = error.statusCode || statusCode;

  // In production, never expose internal details for server-side errors.
  // Client errors (4xx) get their human-readable message; 5xx gets a generic one.
  const safeMessage = isProduction && finalStatusCode >= 500
    ? 'An unexpected error occurred. Please try again later.'
    : error.message || 'Server Error';

  // Never expose the error code in production for 5xx (reveals internals)
  const safeCode = isProduction && finalStatusCode >= 500
    ? 'SERVER_ERROR'
    : error.code || code;

  res.status(finalStatusCode).json({
    success: false,
    error: safeMessage,
    code: safeCode
  });
};

export const notFound = (req, res, next) => {
  // Do not echo the full URL back — it can leak internal routing details
  const error = new Error('The requested resource was not found.');
  error.statusCode = 404;
  error.code = 'NOT_FOUND';
  res.status(404);
  next(error);
};

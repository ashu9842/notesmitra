export const successResponse = (res, data = {}, message) => {
  const payload = { success: true };

  if (message) {
    payload.message = message;
  }

  if (data && typeof data === 'object') {
    Object.assign(payload, data);
  }

  return res.json(payload);
};

import { ERROR_CODES } from '../config/constants.js';

export const errorResponse = (res, error) => {
  const statusCode = error?.statusCode || 500;
  const message = error?.message || 'Server Error';
  const code = error?.code || ERROR_CODES.UNKNOWN;

  return res.status(statusCode).json({
    success: false,
    error: message,
    code
  });
};

export const ROLES = {
  BUYER: 'buyer',
  SELLER: 'seller',
  ADMIN: 'admin'
};

export const AUTH_LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 50,
  PASSWORD_MIN: 6
};

export const AUTH_COOKIES = {
  ACCESS: 'accessToken',
  REFRESH: 'refreshToken'
};

export const AUTH_TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh'
};

export const ERROR_CODES = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTH: 'AUTH_ERROR',
  PAYMENT: 'PAYMENT_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

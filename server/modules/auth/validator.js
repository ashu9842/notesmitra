import { z } from 'zod';
import { ROLES, AUTH_LIMITS } from '../../config/constants.js';

export const signupSchema = z.object({
  name: z.string().min(AUTH_LIMITS.NAME_MIN).max(AUTH_LIMITS.NAME_MAX),
  email: z.string().email(),
  password: z.string().min(AUTH_LIMITS.PASSWORD_MIN),
  // Role indicates primary activity, but users can do both sell & buy
  role: z.enum([ROLES.BUYER, ROLES.SELLER]).default(ROLES.BUYER)
});

export const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional()
});

export const updateProfileSchema = z
  .object({
    name: z.string().min(AUTH_LIMITS.NAME_MIN).max(AUTH_LIMITS.NAME_MAX).optional(),
    email: z.string().email().optional()
  })
  .refine((data) => Boolean(data.name || data.email), {
    message: 'Provide at least one field to update',
    path: ['name']
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(AUTH_LIMITS.PASSWORD_MIN)
});

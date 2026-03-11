/**
 * Passport.js Google OAuth2 Strategy
 *
 * Sets up Google OAuth for sign-in / sign-up.
 * Runs only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured in .env.
 *
 * Flow:
 *   1. User hits GET /api/auth/google  →  redirected to Google consent screen
 *   2. Google redirects to GET /api/auth/google/callback with ?code=...
 *   3. Passport exchanges the code for an access token and fetches the user profile
 *   4. This verify callback finds or creates the NotesMitra user
 *   5. The controller sets JWT cookies and redirects the SPA to CLIENT_URL?oauth=success
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import config from './env.js';
import User from '../models/User.js';
import Institution from '../models/Institution.js';
import Wallet from '../models/Wallet.js';
import logger from '../utils/logger.js';

const initializePassport = () => {
  if (!config.googleClientId || !config.googleClientSecret) {
    logger.info('Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing). Skipping passport setup.');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: config.googleClientId,
        clientSecret: config.googleClientSecret,
        callbackURL: config.googleCallbackUrl,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('Google account has no verified email address'), null);
          }

          // Ensure NotesMitra institution exists
          let institution = await Institution.findOne({ slug: 'notesmitra' });
          if (!institution) {
            institution = await Institution.create({
              name: 'NotesMitra',
              slug: 'notesmitra',
              plan: 'premium',
              maxUsers: 50000,
              storageLimit: 1000,
              isActive: true,
            });
          }

          if (!institution.isActive) {
            return done(new Error('Platform is currently unavailable'), null);
          }

          // 1. Try to find by googleId
          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            // 2. Try to find by email (link Google to existing account)
            user = await User.findOne({ email, tenantId: institution._id });

            if (user) {
              // Link Google ID to the existing account
              user.googleId = profile.id;
              await user.save();
            } else {
              // 3. Create brand-new user (default role: buyer)
              user = await User.create({
                name: profile.displayName || email.split('@')[0],
                email,
                googleId: profile.id,
                role: 'buyer',
                tenantId: institution._id,
                isTenantAdmin: false,
                isActive: true,
              });

              // Create wallet for the new user
              await Wallet.create({
                userId: user._id,
                tenantId: institution._id,
                balance: 0,
                transactions: [],
              });
            }
          }

          return done(null, user);
        } catch (error) {
          logger.error('Google OAuth verify callback error', { error: error.message });
          return done(error, null);
        }
      }
    )
  );
};

export { passport };
export default initializePassport;

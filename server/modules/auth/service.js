export class AuthService {
  constructor({ repository, jwt, crypto, AppError, constants, emitAdminStatsUpdate }) {
    this.repository = repository;
    this.jwt = jwt;
    this.crypto = crypto;
    this.AppError = AppError;
    this.constants = constants;
    this.emitAdminStatsUpdate = emitAdminStatsUpdate;
  }

  createError(message, statusCode, code) {
    return new this.AppError(message, statusCode, code);
  }

  parseCookies(cookieHeader) {
    if (!cookieHeader) return {};

    return cookieHeader.split(';').reduce((acc, part) => {
      const [key, ...valueParts] = part.trim().split('=');
      if (!key) return acc;
      acc[key] = decodeURIComponent(valueParts.join('=') || '');
      return acc;
    }, {});
  }

  generateAccessToken(id) {
    return this.jwt.sign({ id }, this.constants.jwtAccessSecret, {
      expiresIn: this.constants.jwtAccessExpire || '15m'
    });
  }

  generateRefreshToken() {
    return this.crypto.randomBytes(64).toString('hex');
  }

  async storeRefreshToken(userId, token) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.repository.createRefreshToken({ userId, token, expiresAt });
  }

  // Helper: Check subscription expiry and normalize user premium status
  async getActiveSubscriptionStatus(user) {
    if (!user) return { isPremiumBuyer: false, isPremiumSeller: false, hasExpired: false };
    
    // Check if subscription has expired
    const hasActiveSubscription = user.hasActiveSubscription ? user.hasActiveSubscription() : 
      (user.subscriptionExpiry ? new Date() <= user.subscriptionExpiry : false);

    const hasExpiredSubscription = (user.isPremiumBuyer || user.isPremiumSeller) && !hasActiveSubscription;

    // If subscription expired, update it in the database
    if (hasExpiredSubscription) {
      try {
        await this.repository.updateUserById(user._id, {
          isPremiumBuyer: false,
          isPremiumSeller: false,
          subscriptionType: 'free_buyer',
          subscriptionExpiry: null,
          currentSubscriptionId: null
        });
      } catch (error) {
        // Log but don't throw - user data is still valid even if we can't update DB
      }
    }

    return {
      isPremiumBuyer: user.isPremiumBuyer && hasActiveSubscription,
      isPremiumSeller: user.isPremiumSeller && hasActiveSubscription,
      hasExpired: hasExpiredSubscription
    };
  }

  async signupUser({ email, password, name, role }) {
    const { ROLES, ERROR_CODES } = this.constants;

    if (!email || !password || !name) {
      throw this.createError('Please provide email, password, and name', 400, ERROR_CODES.VALIDATION);
    }

    if (!role || !Object.values(ROLES).includes(role)) {
      throw this.createError(`Please provide a valid role (${Object.values(ROLES).join(' or ')})`, 400, ERROR_CODES.VALIDATION);
    }

    // STEP 1: Get or create 'NotesMitra' tenant (single-tenant system)
    let institution;

    try {
      // Look for existing NotesMitra tenant
      institution = await this.repository.findInstitutionBySlug('notesmitra');
      
      if (!institution) {
        // Create NotesMitra tenant if it doesn't exist
        institution = await this.repository.createInstitution({
          name: 'NotesMitra',
          slug: 'notesmitra',
          plan: 'premium',
          maxUsers: 50000,
          storageLimit: 1000,
          isActive: true
        });
      }
    } catch (error) {
      if (error.name === 'ValidationError' || error.name === 'MongoError') {
        throw this.createError('Failed to initialize tenant', 400, ERROR_CODES.VALIDATION);
      }
      throw error;
    }

    // STEP 2: Check tenant is active
    if (!institution.isActive) {
      throw this.createError('Tenant account is inactive', 403, ERROR_CODES.VALIDATION);
    }

    // STEP 3: Check if user already exists in this tenant
    const userExists = await this.repository.findUserByEmail(email, { tenantId: institution._id });
    if (userExists) {
      throw this.createError('User already exists with this email in this tenant', 400, ERROR_CODES.VALIDATION);
    }

    // STEP 4: Validate role - only buyer or seller allowed on signup
    if (!role || ![ROLES.BUYER, ROLES.SELLER].includes(role)) {
      throw this.createError(
        `Please choose a valid role: ${ROLES.BUYER} or ${ROLES.SELLER}`,
        400,
        ERROR_CODES.VALIDATION
      );
    }

    // STEP 5: Create user with tenant (never as admin from signup)
    const user = await this.repository.createUser({
      name,
      email,
      password,
      role: role, // Use exactly what user provided (buyer or seller only)
      tenantId: institution._id,
      isTenantAdmin: false, // Regular users are never admins
      needsEmailVerification: true, // New users must verify email
      isEmailVerified: false
    });

    // STEP 6: Create wallet for user
    await this.repository.createWalletForUser({
      userId: user._id,
      tenantId: institution._id,
      balance: 0,
      transactions: []
    });

    // STEP 7: Generate tokens
    const accessToken = this.generateAccessToken(user._id);
    const refreshToken = this.generateRefreshToken();

    await this.storeRefreshToken(user._id, refreshToken);

    await this.emitAdminStatsUpdate();

    return {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isEmailVerified: user.needsEmailVerification ? (user.isEmailVerified ? true : false) : null,
        isTenantAdmin: user.isTenantAdmin,
        tenantId: institution._id,
        tenant: {
          id: institution._id,
          name: institution.name,
          slug: institution.slug,
          plan: institution.plan
        }
      },
      accessToken,
      refreshToken
    };
  }

  _slugify(name) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  // Find or create a user authenticated via Firebase/Google
  async findOrCreateGoogleUser({ googleId, email, name, picture }) {
    const { ROLES } = this.constants;

    // Try finding by googleId first, then by email (for accounts that pre-existed)
    let user = await this.repository.findUserByGoogleId(googleId);

    if (!user) {
      user = await this.repository.findUserByEmail(email);
    }

    if (user) {
      // Link googleId if not already set
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    } else {
      // Resolve NotesMitra tenant (same as signupUser)
      let institution = await this.repository.findInstitutionBySlug('notesmitra');
      if (!institution) {
        institution = await this.repository.createInstitution({
          name: 'NotesMitra',
          slug: 'notesmitra',
          plan: 'premium',
          maxUsers: 50000,
          storageLimit: 1000,
          isActive: true
        });
      }

      // Create a new user — no password required (Google-only account)
      user = await this.repository.createUser({
        name: name || email.split('@')[0],
        email,
        password: undefined,
        role: ROLES.BUYER,
        tenantId: institution._id,
      });
      user.googleId = googleId;
      await user.save();

      // Create wallet for new Google user (mirrors signupUser)
      await this.repository.createWalletForUser({
        userId: user._id,
        tenantId: institution._id,
        balance: 0,
        transactions: []
      });
    }

    return {
      id: user._id,
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isEmailVerified: user.needsEmailVerification ? (user.isEmailVerified ? true : false) : null,
      walletBalance: user.walletBalance,
      totalEarnings: user.totalEarnings,
      totalSpent: user.totalSpent,
      isPremiumBuyer: (await this.getActiveSubscriptionStatus(user)).isPremiumBuyer || false,
      isPremiumSeller: (await this.getActiveSubscriptionStatus(user)).isPremiumSeller || false,
      subscriptionType: user.subscriptionType || 'free_buyer',
      subscriptionExpiry: user.subscriptionExpiry || null,
      currentSubscriptionId: user.currentSubscriptionId || null,
      monthlyUploadsCount: user.monthlyUploadsCount || 0
    };
  }

  // Issue fresh JWT + refresh token for an already-authenticated user (e.g. after Google OAuth)
  async issueTokensForUser(user) {
    const accessToken = this.generateAccessToken(user._id);
    const refreshToken = this.generateRefreshToken();
    await this.storeRefreshToken(user._id, refreshToken);
    return { accessToken, refreshToken };
  }

  async signinUser({ email, password }) {
    const { ERROR_CODES } = this.constants;

    if (!email || !password) {
      throw this.createError('Please provide email and password', 400, ERROR_CODES.VALIDATION);
    }

    const user = await this.repository.findUserByEmail(email, { includePassword: true });

    if (!user) {
      throw this.createError('Invalid credentials', 401, ERROR_CODES.AUTH);
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      throw this.createError('Invalid credentials', 401, ERROR_CODES.AUTH);
    }

    if (!user.isActive) {
      throw this.createError('Account is deactivated', 401, ERROR_CODES.AUTH);
    }

    const accessToken = this.generateAccessToken(user._id);
    const refreshToken = this.generateRefreshToken();

    await this.storeRefreshToken(user._id, refreshToken);

    const { isPremiumBuyer, isPremiumSeller } = await this.getActiveSubscriptionStatus(user);

    return {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isEmailVerified: user.needsEmailVerification ? (user.isEmailVerified ? true : false) : null,
        walletBalance: user.walletBalance,
        totalEarnings: user.totalEarnings,
        totalSpent: user.totalSpent,
        isPremiumBuyer: isPremiumBuyer || false,
        isPremiumSeller: isPremiumSeller || false,
        subscriptionType: user.subscriptionType || 'free_buyer',
        subscriptionExpiry: user.subscriptionExpiry || null,
        currentSubscriptionId: user.currentSubscriptionId || null,
        monthlyUploadsCount: user.monthlyUploadsCount || 0
      },
      accessToken,
      refreshToken
    };
  }

  async refreshAccessTokenForUser({ refreshToken, cookieHeader, refreshCookieName }) {
    const { ERROR_CODES } = this.constants;
    const cookies = this.parseCookies(cookieHeader);
    const token = refreshToken || cookies[refreshCookieName];

    if (!token) {
      throw this.createError('Refresh token is required', 401, ERROR_CODES.AUTH);
    }

    const storedToken = await this.repository.findRefreshTokenByToken(token);

    if (!storedToken) {
      throw this.createError('Invalid refresh token', 403, ERROR_CODES.AUTH);
    }

    if (new Date() > storedToken.expiresAt) {
      await this.repository.deleteRefreshTokenById(storedToken._id);
      throw this.createError('Refresh token expired', 403, ERROR_CODES.AUTH);
    }

    const user = await this.repository.findUserById(storedToken.userId);

    if (!user || !user.isActive) {
      throw this.createError('User not found or inactive', 403, ERROR_CODES.AUTH);
    }

    const accessToken = this.generateAccessToken(user._id);

    return { accessToken };
  }

  async changeUserPassword({ userId, currentPassword, newPassword }) {
    const { ERROR_CODES } = this.constants;

    if (!currentPassword || !newPassword) {
      throw this.createError('Please provide current and new password', 400, ERROR_CODES.VALIDATION);
    }

    if (newPassword.length < 8) {
      throw this.createError('New password must be at least 8 characters', 400, ERROR_CODES.VALIDATION);
    }

    if (currentPassword === newPassword) {
      throw this.createError('New password must be different from current password', 400, ERROR_CODES.VALIDATION);
    }

    // Find user with password field
    const user = await this.repository.findUserById(userId, { includePassword: true });
    if (!user) {
      throw this.createError('User not found', 404, ERROR_CODES.VALIDATION);
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw this.createError('Current password is incorrect', 401, ERROR_CODES.AUTH);
    }

    // Update with new password
    user.password = newPassword;
    await user.save();

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role
    };
  }

  async logoutUser({ cookieHeader, refreshCookieName }) {
    const cookies = this.parseCookies(cookieHeader);
    const refreshToken = cookies[refreshCookieName];

    if (refreshToken) {
      await this.repository.deleteRefreshTokenByToken(refreshToken);
    }

    return { refreshTokenCleared: Boolean(refreshToken) };
  }

  async getUserProfile(userId) {
    const { ERROR_CODES } = this.constants;
    const user = await this.repository.findUserById(userId);

    if (!user) {
      throw this.createError('User not found', 404, ERROR_CODES.AUTH);
    }

    // Check if subscription has expired and auto-downgrade if needed
    const hasActiveSubscription = user.hasActiveSubscription();
    let isPremiumBuyer = user.isPremiumBuyer && hasActiveSubscription;
    let isPremiumSeller = user.isPremiumSeller && hasActiveSubscription;
    let subscriptionType = user.subscriptionType || 'free_buyer';
    let subscriptionExpiry = user.subscriptionExpiry || null;

    // If subscription expired, downgrade to free and save
    if ((user.isPremiumBuyer || user.isPremiumSeller) && !hasActiveSubscription) {
      subscriptionType = 'free_buyer';
      isPremiumBuyer = false;
      isPremiumSeller = false;
      subscriptionExpiry = null;
      
      // Update in database
      await this.repository.updateUserById(userId, {
        isPremiumBuyer: false,
        isPremiumSeller: false,
        subscriptionType: 'free_buyer',
        subscriptionExpiry: null,
        currentSubscriptionId: null
      });
    }

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone || null,
      role: user.role,
      isEmailVerified: user.needsEmailVerification ? (user.isEmailVerified ? true : false) : null,
      walletBalance: user.walletBalance,
      totalEarnings: user.totalEarnings,
      totalSpent: user.totalSpent,
      createdAt: user.createdAt,
      // Premium subscription fields - checked for expiry
      isPremiumBuyer,
      isPremiumSeller,
      subscriptionType,
      subscriptionExpiry,
      currentSubscriptionId: user.currentSubscriptionId || null,
      monthlyUploadsCount: user.monthlyUploadsCount || 0
    };
  }

  async updateUserProfile({ userId, name, email, phone }) {
    const { ERROR_CODES } = this.constants;
    const fieldsToUpdate = {};
    if (name) fieldsToUpdate.name = name;
    if (email) fieldsToUpdate.email = email;
    if (phone !== undefined) fieldsToUpdate.phone = phone || null;

    const user = await this.repository.updateUserById(
      userId,
      fieldsToUpdate,
      { new: true, runValidators: true }
    );

    if (!user) {
      throw this.createError('User not found', 404, ERROR_CODES.AUTH);
    }

    return user;
  }
}


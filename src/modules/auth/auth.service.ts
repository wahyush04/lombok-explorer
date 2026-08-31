import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthProvider, Prisma, User, UserRole } from '@prisma/client';
import { config } from '../../config/config';
import { prisma } from '../../database/prisma';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../common/errors/app-error';
import { authRepository, AuthRepository } from './auth.repository';
import {
  AuthProvidersResult,
  AuthTokens,
  CompleteGoogleRegistrationDto,
  CompleteGoogleRegistrationResult,
  GoogleAuthDto,
  GoogleAuthResult,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  SanitizedUser,
} from './dto/auth.dto';
import { AuthUserPayload } from '../../common/types';
import { googleAuthService, IGoogleAuthService } from './google-auth.service';

export class AuthService {
  private readonly saltRounds = 12;

  constructor(
    private readonly repository: AuthRepository = authRepository,
    private readonly googleAuth: IGoogleAuthService = googleAuthService,
  ) {}

  public async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  public async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  public generateTokens(user: { id: string; email: string; name: string; role: UserRole }): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } {
    const payload: AuthUserPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: config.jwt.accessExpiresIn as unknown as number, // e.g. "15m"
    });

    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.refreshSecret,
      {
        expiresIn: config.jwt.refreshExpiresIn as unknown as number, // e.g. "7d"
      },
    );

    // Calculate expiresIn in seconds (e.g. 1h -> 3600, 15m -> 900)
    let expiresIn = 3600;
    if (typeof config.jwt.accessExpiresIn === 'string') {
      const match = config.jwt.accessExpiresIn.match(/^(\d+)([smhd])$/);
      if (match && match[1] && match[2]) {
        const val = parseInt(match[1], 10);
        const unit = match[2];
        if (unit === 's') expiresIn = val;
        else if (unit === 'm') expiresIn = val * 60;
        else if (unit === 'h') expiresIn = val * 3600;
        else if (unit === 'd') expiresIn = val * 86400;
      }
    } else if (typeof config.jwt.accessExpiresIn === 'number') {
      expiresIn = config.jwt.accessExpiresIn;
    }

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  public sanitizeUser(user: User): SanitizedUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      role: user.role,
      travelStyle: user.travelStyle,
      preferredRegion: user.preferredRegion,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  public async register(dto: RegisterDto): Promise<AuthTokens> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const normalizedUsername = dto.username.toLowerCase().trim();

    // 1. Check if email already exists
    const existingEmail = await this.repository.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new ConflictError(
        'An account with this email address already exists',
        'EMAIL_ALREADY_EXISTS',
      );
    }

    // 2. Check if username already exists
    const existingUsername = await this.repository.findByUsername(normalizedUsername);
    if (existingUsername) {
      throw new ConflictError(
        'Username is already taken',
        'USERNAME_ALREADY_EXISTS',
      );
    }

    // 3. Hash password with bcrypt
    const hashedPassword = await this.hashPassword(dto.password);

    // 4. Create user record
    try {
      const user = await this.repository.create({
        username: normalizedUsername,
        name: dto.name,
        email: normalizedEmail,
        password: hashedPassword,
        role: dto.role || UserRole.USER,
        travelStyle: dto.travelStyle,
        preferredRegion: dto.preferredRegion,
        avatarUrl: dto.avatarUrl,
        phone: dto.phone,
      });

      // 5. Generate JWT token pair
      const tokens = this.generateTokens(user);

      // 6. Store refresh token for session tracking and rotation
      await this.repository.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: 'Bearer',
        user: this.sanitizeUser(user),
      };
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = String((err.meta as { target?: string[] | string })?.target || '');
        if (target.includes('username')) {
          throw new ConflictError('Username is already taken', 'USERNAME_ALREADY_EXISTS');
        }
        throw new ConflictError(
          'An account with this email address already exists',
          'EMAIL_ALREADY_EXISTS',
        );
      }
      throw err;
    }
  }

  public async login(dto: LoginDto): Promise<AuthTokens> {
    // 1. Find user by email or username
    const rawIdentifier = (dto.identifier || dto.email || dto.username || '').toLowerCase().trim();
    if (!rawIdentifier) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const user = await this.repository.findByEmailOrUsername(rawIdentifier);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // 2. Verify password with bcrypt
    if (!user.password) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isValidPassword = await this.comparePassword(dto.password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // 3. Check account active status
    if (user.deletedAt) {
      throw new UnauthorizedError('Account has been deleted', 'ACCOUNT_DELETED');
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenError(
        'Your account has been suspended. Please contact administrator.',
        'ACCOUNT_SUSPENDED',
      );
    }

    if (user.status === 'INACTIVE') {
      throw new ForbiddenError(
        'Your account is inactive. Please contact administrator.',
        'ACCOUNT_INACTIVE',
      );
    }

    // 4. Generate tokens
    const tokens = this.generateTokens(user);

    // 5. Save refresh token
    await this.repository.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Dedicated Admin login method enforcing ADMIN role and active status.
   */
  public async adminLogin(dto: LoginDto): Promise<AuthTokens> {
    // 1. Find user by email or username
    const rawIdentifier = (dto.identifier || dto.email || dto.username || '').toLowerCase().trim();
    if (!rawIdentifier) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const user = await this.repository.findByEmailOrUsername(rawIdentifier);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // 2. Check if user is active (not deactivated or suspended)
    if (user.deletedAt) {
      throw new UnauthorizedError('User account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      throw new ForbiddenError(
        'Your administrator account is suspended or inactive. Please contact system owner.',
        'ACCOUNT_SUSPENDED',
      );
    }

    // 3. Verify password with bcrypt
    if (!user.password) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isValidPassword = await this.comparePassword(dto.password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    // 4. Role Authorization: Must be ADMIN
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenError('Admin access required', 'ADMIN_ACCESS_REQUIRED');
    }

    // 5. Generate tokens
    const tokens = this.generateTokens(user);

    // 6. Save refresh token for rotation
    await this.repository.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
      user: this.sanitizeUser(user),
    };
  }

  public async refreshToken(dto: RefreshTokenDto): Promise<AuthTokens> {
    try {
      // 1. Verify refresh token signature & expiration
      const decoded = jwt.verify(dto.refreshToken, config.jwt.refreshSecret) as {
        userId: string;
        email: string;
      };

      // 2. Find user in database
      const user = await this.repository.findById(decoded.userId);
      if (!user || user.refreshToken !== dto.refreshToken) {
        // If the token doesn't match the current stored token, it might be revoked or stolen
        throw new UnauthorizedError(
          'Refresh token is invalid or has been revoked',
          'INVALID_REFRESH_TOKEN',
        );
      }

      // 3. Perform Refresh Token Rotation (generate new access and refresh tokens)
      const tokens = this.generateTokens(user);

      // 4. Update database with new refresh token
      await this.repository.updateRefreshToken(user.id, tokens.refreshToken);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: 'Bearer',
        user: this.sanitizeUser(user),
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }
  }

  public async logout(userId: string): Promise<void> {
    await this.repository.clearRefreshToken(userId);
  }

  public async getMe(userId: string): Promise<SanitizedUser> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundError('User profile not found', 'USER_NOT_FOUND');
    }

    return this.sanitizeUser(user);
  }

  /**
   * Generates a signed, short-lived registration token for new Google users (Phase 13).
   * Contains purpose = GOOGLE_REGISTRATION, googleSub, email, name, avatarUrl.
   * Signed with a dedicated secret, expires in 10 minutes, and cannot be used as an access token.
   */
  public generateGoogleRegistrationToken(profile: {
    sub: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): string {
    const registrationSecret = `${config.jwt.accessSecret}:google_registration`;
    return jwt.sign(
      {
        purpose: 'GOOGLE_REGISTRATION',
        googleSub: profile.sub,
        sub: profile.sub,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
      registrationSecret,
      { expiresIn: '10m' },
    );
  }

  /**
   * Verifies and decodes Google registration token with purpose and error code enforcement (Phase 13 & 14).
   */
  public verifyGoogleRegistrationToken(token: string): {
    sub: string;
    email: string;
    name: string;
    avatarUrl?: string;
  } {
    const registrationSecret = `${config.jwt.accessSecret}:google_registration`;
    try {
      const decoded = jwt.verify(token, registrationSecret) as {
        purpose?: string;
        googleSub?: string;
        sub?: string;
        email?: string;
        name?: string;
        avatarUrl?: string;
      };

      if (
        decoded.purpose !== 'GOOGLE_REGISTRATION' ||
        (!decoded.googleSub && !decoded.sub) ||
        !decoded.email
      ) {
        throw new UnauthorizedError(
          'Invalid registration token purpose or payload',
          'REGISTRATION_TOKEN_INVALID',
        );
      }

      return {
        sub: decoded.googleSub || decoded.sub!,
        email: decoded.email,
        name: decoded.name || '',
        avatarUrl: decoded.avatarUrl,
      };
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError(
          'Registration token has expired. Please sign in with Google again.',
          'REGISTRATION_TOKEN_EXPIRED',
        );
      }
      throw new UnauthorizedError(
        'Invalid or malformed registration token',
        'REGISTRATION_TOKEN_INVALID',
      );
    }
  }

  /**
   * Google Sign-In & Single-Account Linking flow (Phase 4 & 5):
   * 1. Validate & verify Google ID Token cryptographically
   * 2. Extract Google sub, email, name, avatar
   * 3. Look up AuthIdentity(provider: GOOGLE, providerAccountId: sub)
   * 4. If found -> CASE A: Log in to existing linked account
   *    If not found -> Check if user with same verified email exists:
   *      - If exists -> CASE B: Link Google identity to existing User account & return LOGIN_SUCCESS
   *      - If not exists -> PHASE 5: Return REGISTRATION_REQUIRED with registrationToken & profile
   * 5. Enforce account status checks (deleted, suspended, inactive)
   * 6. Issue access & refresh JWT tokens
   */
  public async googleLogin(dto: GoogleAuthDto): Promise<GoogleAuthResult> {
    // 1. Verify Google ID Token
    const googleUser = await this.googleAuth.verifyIdToken(dto.idToken);

    // 2. Find AuthIdentity
    const identity = await this.repository.findIdentity(AuthProvider.GOOGLE, googleUser.sub);
    let user: User;

    if (identity) {
      // CASE A: SUDAH TERTAUT
      user = identity.user;
    } else {
      // Identity not found -> check if User with verified Google email exists
      const existingUser = await this.repository.findByEmail(googleUser.email);

      if (existingUser) {
        // CASE B: User with email exists -> Link Google AuthIdentity to this existing User
        await this.repository.createIdentity(existingUser.id, AuthProvider.GOOGLE, googleUser.sub);
        user = existingUser;
      } else {
        // PHASE 5: Google identity tidak ditemukan dan user belum ada
        // Jangan langsung membuat User. Return status REGISTRATION_REQUIRED with signed registrationToken
        const registrationToken = this.generateGoogleRegistrationToken({
          sub: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
          avatarUrl: googleUser.avatarUrl,
        });

        return {
          status: 'REGISTRATION_REQUIRED',
          registrationToken,
          profile: {
            name: googleUser.name,
            email: googleUser.email,
            avatarUrl: googleUser.avatarUrl || null,
          },
        };
      }
    }

    // 3. Check account active status
    if (user.deletedAt) {
      throw new UnauthorizedError('Account has been deleted', 'ACCOUNT_DELETED');
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenError(
        'Your account has been suspended. Please contact administrator.',
        'ACCOUNT_SUSPENDED',
      );
    }

    if (user.status === 'INACTIVE') {
      throw new ForbiddenError(
        'Your account is inactive. Please contact administrator.',
        'ACCOUNT_INACTIVE',
      );
    }

    // 4. Issue Access Token & Refresh Token
    const tokens = this.generateTokens(user);

    // 5. Update Refresh Token for rotation
    await this.repository.updateRefreshToken(user.id, tokens.refreshToken);

    // 6. Return Login Success Response
    return {
      status: 'LOGIN_SUCCESS',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Complete Google Registration (Phase 6):
   * 1. Verify short-lived registrationToken and recover Google profile
   * 2. Validate username & password
   * 3. Run Prisma transaction:
   *    - Check duplicate email or sub
   *    - Hash password with bcrypt
   *    - Create User
   *    - Create AuthIdentity(provider: GOOGLE, providerAccountId: sub)
   * 4. Issue JWT access & refresh tokens
   * 5. Return session with REGISTRATION_SUCCESS
   */
  public async completeGoogleRegistration(
    dto: CompleteGoogleRegistrationDto,
  ): Promise<CompleteGoogleRegistrationResult> {
    // 1. Verify Registration Token & recover Google profile
    const googleProfile = this.verifyGoogleRegistrationToken(dto.registrationToken);

    const fullName = (dto.name || googleProfile.name || 'User').trim();
    if (fullName.length < 2) {
      throw new BadRequestError('Name must be at least 2 characters', 'INVALID_NAME');
    }

    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestError('Password must be at least 6 characters', 'INVALID_PASSWORD');
    }

    // 2. Hash Password with bcrypt
    const hashedPassword = await this.hashPassword(dto.password);

    // 3. Execute Prisma Transaction with Race-Condition & Unique Constraint Protection (Phase 17)
    try {
      const normalizedUsername = dto.username.toLowerCase().trim();
      const normalizedEmail = googleProfile.email.toLowerCase().trim();

      const user = await prisma.$transaction(async (tx) => {
        // Check if email already exists
        const existingUser = await tx.user.findFirst({
          where: {
            email: normalizedEmail,
            deletedAt: null,
          },
        });

        if (existingUser) {
          throw new ConflictError(
            'An account with this email address already exists',
            'EMAIL_ALREADY_EXISTS',
          );
        }

        // Check if username already exists
        const existingUsername = await tx.user.findFirst({
          where: {
            username: normalizedUsername,
            deletedAt: null,
          },
        });

        if (existingUsername) {
          throw new ConflictError(
            'Username is already taken',
            'USERNAME_ALREADY_EXISTS',
          );
        }

        // Check if Google identity is already linked
        const existingIdentity = await tx.authIdentity.findUnique({
          where: {
            provider_providerAccountId: {
              provider: AuthProvider.GOOGLE,
              providerAccountId: googleProfile.sub,
            },
          },
        });

        if (existingIdentity) {
          throw new ConflictError(
            'This Google account is already registered',
            'GOOGLE_ACCOUNT_ALREADY_LINKED',
          );
        }

        // Create User
        const newUser = await tx.user.create({
          data: {
            username: normalizedUsername,
            name: fullName,
            email: normalizedEmail,
            password: hashedPassword,
            avatarUrl: googleProfile.avatarUrl,
            isEmailVerified: true,
            role: UserRole.USER,
          },
        });

        // Create AuthIdentity
        await tx.authIdentity.create({
          data: {
            userId: newUser.id,
            provider: AuthProvider.GOOGLE,
            providerAccountId: googleProfile.sub,
          },
        });

        return newUser;
      });

      // 4. Generate JWT tokens
      const tokens = this.generateTokens(user);

      // 5. Update refresh token in DB
      await this.repository.updateRefreshToken(user.id, tokens.refreshToken);

      // 6. Return Registration Success
      return {
        status: 'REGISTRATION_SUCCESS',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: 'Bearer',
        user: this.sanitizeUser(user),
      };
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = String((err.meta as { target?: string[] | string })?.target || '');
        if (target.includes('username')) {
          throw new ConflictError(
            'Username is already taken',
            'USERNAME_ALREADY_EXISTS',
          );
        }
        if (target.includes('providerAccountId') || target.includes('provider')) {
          throw new ConflictError(
            'This Google account is already registered',
            'GOOGLE_ACCOUNT_ALREADY_LINKED',
          );
        }
        if (target.includes('email')) {
          throw new ConflictError(
            'An account with this email address already exists',
            'EMAIL_ALREADY_EXISTS',
          );
        }
        throw new ConflictError(
          'An account with this unique information already exists',
          'CONFLICT',
        );
      }
      throw err;
    }
  }

  /**
   * PHASE 8 — Link Google Account to Authenticated User
   * 1. Verify Google ID Token
   * 2. Check if sub is already linked to another user (409 Conflict if linked to another)
   * 3. Create AuthIdentity(userId, provider: GOOGLE, providerAccountId: sub)
   */
  public async linkGoogle(userId: string, dto: GoogleAuthDto): Promise<void> {
    // 1. Verify Google ID Token cryptographically
    const googleUser = await this.googleAuth.verifyIdToken(dto.idToken);

    // 2. Check if this Google account (sub) is already linked to ANY user
    const existingIdentity = await this.repository.findIdentity(
      AuthProvider.GOOGLE,
      googleUser.sub,
    );

    if (existingIdentity) {
      if (existingIdentity.userId === userId) {
        // Already linked to the current user
        return;
      }
      // Linked to a DIFFERENT user -> 409 Conflict
      throw new ConflictError(
        'Google account is already linked to another user',
        'GOOGLE_ACCOUNT_ALREADY_LINKED',
      );
    }

    // 3. Check if current user already has a Google identity linked
    const userIdentities = await this.repository.findIdentitiesByUserId(userId);
    const hasGoogle = userIdentities.some((i) => i.provider === AuthProvider.GOOGLE);
    if (hasGoogle) {
      throw new ConflictError(
        'User already has a linked Google account',
        'USER_ALREADY_HAS_GOOGLE_ACCOUNT',
      );
    }

    // 4. Create Google identity linked to current user with P2002 protection
    try {
      await this.repository.createIdentity(userId, AuthProvider.GOOGLE, googleUser.sub);
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(
          'Google account is already linked to another user',
          'GOOGLE_ACCOUNT_ALREADY_LINKED',
        );
      }
      throw err;
    }
  }

  /**
   * PHASE 9 — Unlink Google Account
   * 1. Check if user has Google identity
   * 2. Ensure user has password or another auth method (prevent losing account access)
   * 3. Delete Google identity
   */
  public async unlinkGoogle(userId: string): Promise<void> {
    // 1. Fetch user to inspect authentication methods
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundError('User account not found', 'USER_NOT_FOUND');
    }

    const identities = await this.repository.findIdentitiesByUserId(userId);
    const hasGoogleIdentity = identities.some((i) => i.provider === AuthProvider.GOOGLE);

    if (!hasGoogleIdentity) {
      throw new NotFoundError('Google account is not linked to this user', 'GOOGLE_NOT_LINKED');
    }

    // 2. Check if user has a password set
    const hasPassword = Boolean(user.password && user.password.length > 0);

    // If user has NO password and Google is their only method -> Reject!
    if (!hasPassword) {
      throw new BadRequestError('Cannot unlink the only authentication method', 'ONLY_AUTH_METHOD');
    }

    // 3. Delete Google identity
    await this.repository.deleteIdentity(userId, AuthProvider.GOOGLE);
  }

  /**
   * PHASE 10 — Get Active Auth Providers for Authenticated User
   * Returns whether password and/or google auth methods are enabled
   */
  public async getAuthProviders(userId: string): Promise<AuthProvidersResult> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new NotFoundError('User account not found', 'USER_NOT_FOUND');
    }

    const identities = await this.repository.findIdentitiesByUserId(userId);
    const hasPassword = Boolean(user.password && user.password.length > 0);
    const hasGoogle = identities.some((i) => i.provider === AuthProvider.GOOGLE);

    return {
      password: hasPassword,
      google: hasGoogle,
    };
  }
}

export const authService = new AuthService();

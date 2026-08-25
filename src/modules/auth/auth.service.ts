import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthProvider, User, UserRole } from '@prisma/client';
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

    // Calculate approx expiresIn in seconds for 15m default
    const expiresIn = 15 * 60;

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  public sanitizeUser(user: User): SanitizedUser {
    return {
      id: user.id,
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
    // 1. Check if email already exists
    const existing = await this.repository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError(
        'An account with this email address already exists',
        'EMAIL_ALREADY_EXISTS',
      );
    }

    // 2. Hash password with bcrypt
    const hashedPassword = await this.hashPassword(dto.password);

    // 3. Create user record
    const user = await this.repository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: dto.role || UserRole.USER,
      travelStyle: dto.travelStyle,
      preferredRegion: dto.preferredRegion,
      avatarUrl: dto.avatarUrl,
      phone: dto.phone,
    });

    // 4. Generate JWT token pair
    const tokens = this.generateTokens(user);

    // 5. Store refresh token for session tracking and rotation
    await this.repository.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      tokenType: 'Bearer',
      user: this.sanitizeUser(user),
    };
  }

  public async login(dto: LoginDto): Promise<AuthTokens> {
    // 1. Find user by email
    const user = await this.repository.findByEmail(dto.email);
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

    // 4. Generate tokens
    const tokens = this.generateTokens(user);

    // 4. Save refresh token
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
    // 1. Find user by email
    const user = await this.repository.findByEmail(dto.email);
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

    // 4. Enforce ADMIN role requirement
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
   * Generates a signed, short-lived registration token for new Google users.
   * Tamper-resistant, contains Google profile data, and cannot be used as access token.
   */
  public generateGoogleRegistrationToken(profile: {
    sub: string;
    email: string;
    name: string;
    avatarUrl?: string;
  }): string {
    return jwt.sign(
      {
        sub: profile.sub,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        type: 'google_registration',
      },
      config.jwt.accessSecret,
      { expiresIn: '15m' },
    );
  }

  /**
   * Verifies and decodes Google registration token.
   */
  public verifyGoogleRegistrationToken(token: string): {
    sub: string;
    email: string;
    name: string;
    avatarUrl?: string;
  } {
    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret) as {
        sub: string;
        email: string;
        name: string;
        avatarUrl?: string;
        type: string;
      };

      if (decoded.type !== 'google_registration' || !decoded.sub || !decoded.email) {
        throw new UnauthorizedError(
          'Invalid registration token payload',
          'INVALID_REGISTRATION_TOKEN',
        );
      }

      return {
        sub: decoded.sub,
        email: decoded.email,
        name: decoded.name,
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
        'INVALID_REGISTRATION_TOKEN',
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

    const username = dto.username || dto.name || googleProfile.name;
    if (!username || username.trim().length < 2) {
      throw new BadRequestError('Username must be at least 2 characters', 'INVALID_USERNAME');
    }

    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestError('Password must be at least 6 characters', 'INVALID_PASSWORD');
    }

    // 2. Hash Password with bcrypt
    const hashedPassword = await this.hashPassword(dto.password);

    // 3. Execute Prisma Transaction
    const user = await prisma.$transaction(async (tx) => {
      // Check if email already exists
      const existingUser = await tx.user.findFirst({
        where: {
          email: googleProfile.email.toLowerCase().trim(),
          deletedAt: null,
        },
      });

      if (existingUser) {
        throw new ConflictError(
          'An account with this email address already exists',
          'EMAIL_ALREADY_EXISTS',
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
          'IDENTITY_ALREADY_EXISTS',
        );
      }

      // Create User
      const newUser = await tx.user.create({
        data: {
          name: username.trim(),
          email: googleProfile.email.toLowerCase().trim(),
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
  }
}

export const authService = new AuthService();

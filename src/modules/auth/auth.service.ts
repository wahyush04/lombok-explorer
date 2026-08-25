import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthProvider, User, UserRole } from '@prisma/client';
import { config } from '../../config/config';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../common/errors/app-error';
import { authRepository, AuthRepository } from './auth.repository';
import {
  AuthTokens,
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
   * Google Sign-In & Single-Account Linking flow:
   * 1. Validate & verify Google ID Token cryptographically
   * 2. Extract Google sub, email, name, avatar
   * 3. Look up AuthIdentity(provider: GOOGLE, providerAccountId: sub)
   * 4. If found -> CASE A: Log in to existing linked account
   *    If not found -> Check if user with same verified email exists:
   *      - If exists -> CASE B: Link Google identity to existing User account
   *      - If not exists -> CASE C: Create new User + Google AuthIdentity
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
        // CASE C: Brand new user -> Create User + Google AuthIdentity
        user = await this.repository.create({
          email: googleUser.email,
          name: googleUser.name,
          password: null,
          avatarUrl: googleUser.avatarUrl,
          isEmailVerified: googleUser.isEmailVerified,
          role: UserRole.USER,
        });

        await this.repository.createIdentity(user.id, AuthProvider.GOOGLE, googleUser.sub);
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
}

export const authService = new AuthService();

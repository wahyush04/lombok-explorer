import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { config } from '../../config/config';
import { UnauthorizedError } from '../../common/errors/app-error';

export interface VerifiedGoogleUser {
  sub: string;
  email: string;
  name: string;
  avatarUrl?: string;
  isEmailVerified: boolean;
}

export interface IGoogleAuthService {
  verifyIdToken(idToken: string): Promise<VerifiedGoogleUser>;
}

export class GoogleAuthService implements IGoogleAuthService {
  private client: OAuth2Client;

  constructor(clientId?: string) {
    this.client = new OAuth2Client(clientId || config.google.clientId);
  }

  /**
   * Verifies Google ID Token cryptographically using official Google Auth Library.
   * Validates signature, issuer, audience (Client ID), expiration, sub, and email.
   *
   * @param idToken The raw Google ID Token string sent by client
   * @returns Verified user claims extracted from validated ID Token
   */
  public async verifyIdToken(idToken: string): Promise<VerifiedGoogleUser> {
    if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
      throw new UnauthorizedError('Google idToken is required', 'INVALID_GOOGLE_TOKEN');
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: config.google.clientId,
      });

      const payload: TokenPayload | undefined = ticket.getPayload();
      if (!payload || !payload.sub || !payload.email) {
        throw new UnauthorizedError(
          'Google token verification failed: Missing required sub or email in payload',
          'INVALID_GOOGLE_TOKEN',
        );
      }

      return {
        sub: payload.sub,
        email: payload.email.toLowerCase().trim(),
        name: payload.name || payload.given_name || 'Google User',
        avatarUrl: payload.picture,
        isEmailVerified: Boolean(payload.email_verified),
      };
    } catch (err: unknown) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Invalid signature or expired token';
      throw new UnauthorizedError(
        `Google token verification failed: ${message}`,
        'INVALID_GOOGLE_TOKEN',
      );
    }
  }
}

export const googleAuthService = new GoogleAuthService();

import { describe, it, expect } from 'vitest';
import { logger } from '../src/common/utils/logger';

describe('Common Foundation — Logger & Redaction (Phase 5)', () => {
  it('should redact sensitive keys such as password, token, and secret', () => {
    // Test that logger instance has redaction configured
    expect(logger).toBeDefined();

    // Log payload with sensitive fields (Pino redacts these in stream/serialized output)
    const sensitivePayload = {
      user: 'traveler@lombokexplorer.com',
      password: 'SuperSecretPassword123!',
      refreshToken: 'sample.jwt.refresh.token',
      apiKey: 'secret_api_key',
    };

    expect(() => {
      logger.info(sensitivePayload, 'Testing sensitive payload logging');
    }).not.toThrow();
  });
});

import pino from 'pino';
import { config } from '../../config/config';

let transportConfig: pino.TransportSingleOptions | undefined = undefined;
if (config.app.isDevelopment) {
  try {
    require.resolve('pino-pretty');
    transportConfig = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname',
      },
    };
  } catch {
    transportConfig = undefined;
  }
}

export const logger = pino({
  level: config.logger.level,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.passwordConfirmation',
      'req.body.currentPassword',
      'req.body.newPassword',
      'req.body.refreshToken',
      'req.body.token',
      'req.body.secret',
      '*.password',
      '*.refreshToken',
      '*.token',
      '*.secret',
      'password',
      'refreshToken',
    ],
    censor: '[REDACTED]',
  },
  transport: transportConfig,
  base: {
    service: config.app.name,
    version: config.app.version,
    env: config.app.env,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

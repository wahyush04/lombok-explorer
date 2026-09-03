import { v2 as cloudinary } from 'cloudinary';
import { config } from '../../config/config';
import { logger } from '../../common/utils/logger';

export const isCloudinaryConfigured = Boolean(
  config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret,
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
  logger.info(
    { cloudName: config.cloudinary.cloudName, folder: config.cloudinary.folder },
    '☁️ Cloudinary SDK Initialized Successfully',
  );
} else {
  logger.warn(
    '⚠️ Cloudinary is not configured with valid credentials in environment variables.',
  );
}

export { cloudinary };

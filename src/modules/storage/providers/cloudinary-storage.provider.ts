import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { config } from '../../../config/config';
import { logger } from '../../../common/utils/logger';
import { BadRequestError, InternalServerError } from '../../../common/errors/app-error';
import { ImageVariant, StoredMediaDto, UploadMediaOptions } from '../dto/storage.dto';
import { IStorageProvider, UploadFileInput } from './storage-provider.interface';

export class CloudinaryStorageProvider implements IStorageProvider {
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = Boolean(
      config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret,
    );

    if (this.isConfigured) {
      cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret,
        secure: true,
      });
      logger.info(
        { cloudName: config.cloudinary.cloudName, folder: config.cloudinary.folder },
        '☁️ Cloudinary Storage Provider Initialized Successfully',
      );
    } else {
      logger.warn(
        '⚠️ Cloudinary is not fully configured (missing credentials). Fallback will be used where needed.',
      );
    }
  }

  public getProviderName(): string {
    return 'Cloudinary';
  }

  /**
   * Resolves the target Cloudinary folder based on media type, entity ID, or custom folder.
   */
  private resolveFolder(options?: UploadMediaOptions | string): string {
    const rootFolder = config.cloudinary.folder || 'lombok-explorer';

    if (typeof options === 'string' && options.trim()) {
      return `${rootFolder}/${options.trim().replace(/^\/+|\/+$/g, '')}`;
    }

    if (options && typeof options === 'object') {
      if (options.folder && options.folder.trim()) {
        return `${rootFolder}/${options.folder.trim().replace(/^\/+|\/+$/g, '')}`;
      }

      const entitySub = options.entityId ? `/${options.entityId}` : '';

      switch (options.type) {
        case 'DESTINATION':
          return `${rootFolder}/destinations${entitySub}`;
        case 'ITINERARY':
          return `${rootFolder}/itineraries${entitySub}`;
        case 'ACTIVITY':
          return `${rootFolder}/activities${entitySub}`;
        case 'PROFILE':
          return `${rootFolder}/users${entitySub}`;
        case 'CATEGORY':
          return `${rootFolder}/categories${entitySub}`;
        case 'FEED':
          return `${rootFolder}/feeds${entitySub}`;
        case 'GENERAL':
        default:
          return `${rootFolder}/general`;
      }
    }

    return `${rootFolder}/general`;
  }

  /**
   * Extracts the Cloudinary public_id from a URL or raw public_id string.
   */
  public extractPublicId(publicIdOrUrl: string): string {
    if (!publicIdOrUrl) return '';

    // If it's already a public_id (not a full URL)
    if (!publicIdOrUrl.startsWith('http://') && !publicIdOrUrl.startsWith('https://')) {
      return publicIdOrUrl;
    }

    try {
      // Example: https://res.cloudinary.com/cloud_name/image/upload/v12345/lombok-explorer/destinations/sample.jpg
      const url = new URL(publicIdOrUrl);
      const parts = url.pathname.split('/upload/');
      if (parts.length > 1 && parts[1]) {
        // Strip optional version prefix (e.g. "v1234567890/") and file extension
        const pathAfterUpload = parts[1].replace(/^v\d+\//, '');
        const lastDot = pathAfterUpload.lastIndexOf('.');
        return lastDot > 0 ? pathAfterUpload.substring(0, lastDot) : pathAfterUpload;
      }
    } catch {
      // If URL parsing fails, return as-is
    }

    return publicIdOrUrl;
  }

  /**
   * Generates variant URLs (thumbnail, card, cover) for an asset.
   */
  private generateVariants(publicId: string): { thumbnail: string; card: string; cover: string } {
    return {
      thumbnail: this.generateOptimizedUrl(publicId, 'thumbnail'),
      card: this.generateOptimizedUrl(publicId, 'card'),
      cover: this.generateOptimizedUrl(publicId, 'cover'),
    };
  }

  /**
   * Generates a transformed/optimized Cloudinary URL.
   */
  public generateOptimizedUrl(publicIdOrUrl: string, variant: ImageVariant = 'original'): string {
    const publicId = this.extractPublicId(publicIdOrUrl);
    if (!publicId) return publicIdOrUrl;

    if (!this.isConfigured) {
      return publicIdOrUrl;
    }

    switch (variant) {
      case 'thumbnail':
        return cloudinary.url(publicId, {
          width: 200,
          height: 200,
          crop: 'fill',
          gravity: 'auto',
          fetch_format: 'auto',
          quality: 'auto',
          secure: true,
        });

      case 'card':
        return cloudinary.url(publicId, {
          width: 600,
          height: 400,
          crop: 'fill',
          gravity: 'auto',
          fetch_format: 'auto',
          quality: 'auto',
          secure: true,
        });

      case 'cover':
        return cloudinary.url(publicId, {
          width: 1200,
          height: 675,
          crop: 'fill',
          gravity: 'auto',
          fetch_format: 'auto',
          quality: 'auto',
          secure: true,
        });

      case 'original':
      default:
        return cloudinary.url(publicId, {
          fetch_format: 'auto',
          quality: 'auto',
          secure: true,
        });
    }
  }

  public getFileUrl(filename: string, subfolder?: string): string {
    const folder = subfolder
      ? `${config.cloudinary.folder}/${subfolder}`
      : config.cloudinary.folder;
    return this.generateOptimizedUrl(`${folder}/${filename}`, 'original');
  }

  /**
   * Uploads an image buffer directly to Cloudinary using upload stream.
   */
  public async saveFile(
    file: UploadFileInput,
    options?: UploadMediaOptions | string,
  ): Promise<StoredMediaDto> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestError('No valid file buffer provided for upload', 'FILE_UPLOAD_EMPTY');
    }

    if (!this.isConfigured) {
      throw new InternalServerError(
        'Cloudinary credentials are not configured on this server',
        'CLOUDINARY_NOT_CONFIGURED',
      );
    }

    const folder = this.resolveFolder(options);

    return new Promise<StoredMediaDto>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            logger.error({ err: error }, 'Cloudinary image upload failed');
            return reject(
              new BadRequestError(
                `Failed to upload image to Cloudinary: ${error?.message || 'Unknown error'}`,
                'IMAGE_UPLOAD_FAILED',
              ),
            );
          }

          const optimizedUrl = this.generateOptimizedUrl(result.public_id, 'original');
          const variants = this.generateVariants(result.public_id);

          const storedMedia: StoredMediaDto = {
            url: optimizedUrl,
            secureUrl: result.secure_url || optimizedUrl,
            publicId: result.public_id,
            filename: `${result.public_id.split('/').pop()}.${result.format}`,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: result.bytes || file.size || file.buffer.length,
            width: result.width,
            height: result.height,
            format: result.format,
            provider: this.getProviderName(),
            variants,
          };

          return resolve(storedMedia);
        },
      );

      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);
      bufferStream.pipe(uploadStream);
    });
  }

  /**
   * Deletes an image from Cloudinary by its publicId or URL.
   */
  public async deleteFile(publicIdOrUrl: string): Promise<boolean> {
    const publicId = this.extractPublicId(publicIdOrUrl);
    if (!publicId) return false;

    if (!this.isConfigured) {
      logger.warn({ publicId }, 'Cannot delete from Cloudinary: credentials not configured');
      return true;
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });

      if (result.result === 'ok' || result.result === 'not found') {
        logger.info({ publicId, result: result.result }, 'Cloudinary image deleted successfully');
        return true;
      }

      logger.warn({ publicId, result }, 'Cloudinary delete returned non-ok result');
      return false;
    } catch (err) {
      logger.error({ err, publicId }, 'Error deleting image from Cloudinary');
      // Do not crash the application on delete failure; log and return false
      return false;
    }
  }

  /**
   * Replaces an existing image with a new file.
   * Uploads the new image first, then deletes the old image on success.
   */
  public async replaceFile(
    oldPublicIdOrUrl: string,
    newFile: UploadFileInput,
    options?: UploadMediaOptions | string,
  ): Promise<StoredMediaDto> {
    // 1. Upload new image first
    const newMedia = await this.saveFile(newFile, options);

    // 2. If upload succeeded and old asset exists, delete old asset
    if (oldPublicIdOrUrl) {
      const oldPublicId = this.extractPublicId(oldPublicIdOrUrl);
      if (oldPublicId && oldPublicId !== newMedia.publicId) {
        this.deleteFile(oldPublicId).catch((err) => {
          logger.warn({ err, oldPublicId }, 'Failed to cleanup replaced Cloudinary asset');
        });
      }
    }

    return newMedia;
  }
}

export const cloudinaryStorageProvider = new CloudinaryStorageProvider();

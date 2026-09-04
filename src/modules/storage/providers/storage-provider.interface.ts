import { ImageVariant, StoredMediaDto, UploadMediaOptions } from '../dto/storage.dto';

export interface UploadFileInput {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size?: number;
}

export interface IStorageProvider {
  /**
   * Saves a binary file and returns structured metadata including public access URL.
   */
  saveFile(file: UploadFileInput, options?: UploadMediaOptions | string): Promise<StoredMediaDto>;

  /**
   * Deletes a stored file by its publicId, URL, or relative filename.
   */
  deleteFile(publicIdOrUrl: string): Promise<boolean>;

  /**
   * Replaces an existing stored file with a new file and cleans up the old asset.
   */
  replaceFile(
    oldPublicIdOrUrl: string,
    newFile: UploadFileInput,
    options?: UploadMediaOptions | string,
  ): Promise<StoredMediaDto>;

  /**
   * Generates a transformed/optimized CDN URL with automatic format and quality.
   */
  generateOptimizedUrl(publicIdOrUrl: string, variant?: ImageVariant): string;

  /**
   * Resolves the public accessible URL for a given filename.
   */
  getFileUrl(filename: string, subfolder?: string): string;

  /**
   * Returns provider identifier (e.g. Cloudinary, LocalStorage).
   */
  getProviderName(): string;
}

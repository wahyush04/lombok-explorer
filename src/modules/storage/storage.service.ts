import { BadRequestError } from '../../common/errors/app-error';
import { config } from '../../config/config';
import { ImageVariant, StoredMediaDto, UploadMediaOptions } from './dto/storage.dto';
import {
  cloudinaryStorageProvider,
  IStorageProvider,
  localStorageProvider,
  UploadFileInput,
} from './providers';

export class StorageService {
  private provider: IStorageProvider;

  constructor(provider?: IStorageProvider) {
    if (provider) {
      this.provider = provider;
    } else {
      // Default to Cloudinary if configured, else LocalStorage
      this.provider = config.cloudinary.isConfigured
        ? cloudinaryStorageProvider
        : localStorageProvider;
    }
  }

  /**
   * Allows hot-swapping between Cloudinary, LocalStorage, or Mock providers.
   */
  public setProvider(provider: IStorageProvider): void {
    this.provider = provider;
  }

  public getActiveProviderName(): string {
    return this.provider.getProviderName();
  }

  /**
   * Upload single image with Cloudinary optimization.
   */
  public async uploadImage(
    file: UploadFileInput,
    options?: UploadMediaOptions | string,
  ): Promise<StoredMediaDto> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestError('No valid file uploaded or file is empty', 'FILE_UPLOAD_EMPTY');
    }

    return this.provider.saveFile(file, options);
  }

  /**
   * Upload multiple images concurrently.
   */
  public async uploadMultipleImages(
    files: UploadFileInput[],
    options?: UploadMediaOptions | string,
  ): Promise<StoredMediaDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestError('No files uploaded', 'FILE_UPLOAD_EMPTY');
    }

    const uploadPromises = files.map((file) => this.provider.saveFile(file, options));
    return Promise.all(uploadPromises);
  }

  /**
   * Delete image from storage by public ID or URL.
   */
  public async deleteImage(publicIdOrUrl: string): Promise<boolean> {
    if (!publicIdOrUrl) {
      throw new BadRequestError(
        'Image publicId or URL is required for deletion',
        'INVALID_FILE_PARAM',
      );
    }

    return this.provider.deleteFile(publicIdOrUrl);
  }

  /**
   * Replace existing image with a new file.
   */
  public async replaceImage(
    oldPublicIdOrUrl: string,
    newFile: UploadFileInput,
    options?: UploadMediaOptions | string,
  ): Promise<StoredMediaDto> {
    if (!newFile || !newFile.buffer || newFile.buffer.length === 0) {
      throw new BadRequestError('No new file provided for replacement', 'FILE_UPLOAD_EMPTY');
    }

    return this.provider.replaceFile(oldPublicIdOrUrl, newFile, options);
  }

  /**
   * Generates a transformed/optimized CDN URL with automatic format and quality.
   */
  public generateOptimizedUrl(publicIdOrUrl: string, variant: ImageVariant = 'original'): string {
    return this.provider.generateOptimizedUrl(publicIdOrUrl, variant);
  }

  // =========================================================================
  // Backward compatibility alias methods
  // =========================================================================

  public async uploadFile(file: UploadFileInput, subfolder?: string): Promise<StoredMediaDto> {
    return this.uploadImage(file, subfolder);
  }

  public async uploadMultipleFiles(
    files: UploadFileInput[],
    subfolder?: string,
  ): Promise<StoredMediaDto[]> {
    return this.uploadMultipleImages(files, subfolder);
  }

  public async deleteFile(fileUrlOrName: string): Promise<boolean> {
    return this.deleteImage(fileUrlOrName);
  }

  public getFileUrl(filename: string, subfolder?: string): string {
    return this.provider.getFileUrl(filename, subfolder);
  }
}

export const storageService = new StorageService();
export const mediaStorageService = storageService;

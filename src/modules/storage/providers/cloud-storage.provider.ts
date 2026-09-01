import { ImageVariant, StoredMediaDto, UploadMediaOptions } from '../dto/storage.dto';
import { IStorageProvider, UploadFileInput } from './storage-provider.interface';
import crypto from 'crypto';
import path from 'path';

export class CloudStorageProvider implements IStorageProvider {
  private readonly cdnBaseUrl: string;

  constructor(cdnBaseUrl: string = 'https://cdn.lombokexplorer.com/assets/image') {
    this.cdnBaseUrl = cdnBaseUrl;
  }

  public getProviderName(): string {
    return 'CloudStorage';
  }

  private resolveSubfolder(options?: UploadMediaOptions | string): string | undefined {
    if (typeof options === 'string') return options;
    if (options && typeof options === 'object') {
      if (options.folder) return options.folder;
      if (options.type) return options.type.toLowerCase();
    }
    return undefined;
  }

  public async saveFile(
    file: UploadFileInput,
    options?: UploadMediaOptions | string,
  ): Promise<StoredMediaDto> {
    const subfolder = this.resolveSubfolder(options);
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${crypto.randomUUID()}${ext}`;
    const key = subfolder ? `${subfolder}/${filename}` : filename;
    const url = `${this.cdnBaseUrl}/${key}`;

    return {
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size ?? file.buffer.length,
      url,
      secureUrl: url,
      publicId: key,
      provider: this.getProviderName(),
      variants: {
        thumbnail: url,
        card: url,
        cover: url,
      },
    };
  }

  public async deleteFile(_publicIdOrUrl: string): Promise<boolean> {
    // Cloud storage deletion stub
    return true;
  }

  public async replaceFile(
    oldPublicIdOrUrl: string,
    newFile: UploadFileInput,
    options?: UploadMediaOptions | string,
  ): Promise<StoredMediaDto> {
    const saved = await this.saveFile(newFile, options);
    if (oldPublicIdOrUrl) {
      await this.deleteFile(oldPublicIdOrUrl);
    }
    return saved;
  }

  public generateOptimizedUrl(publicIdOrUrl: string, _variant: ImageVariant = 'original'): string {
    return publicIdOrUrl;
  }

  public getFileUrl(filename: string, subfolder?: string): string {
    return subfolder
      ? `${this.cdnBaseUrl}/${subfolder}/${filename}`
      : `${this.cdnBaseUrl}/${filename}`;
  }
}

export const cloudStorageProvider = new CloudStorageProvider();

import { StoredFileDto } from '../dto/storage.dto';
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

  public async saveFile(file: UploadFileInput, subfolder?: string): Promise<StoredFileDto> {
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
      path: `s3://lombok-explorer-bucket/${key}`,
      provider: this.getProviderName(),
    };
  }

  public async deleteFile(_fileUrlOrName: string): Promise<boolean> {
    // Cloud storage deletion stub
    return true;
  }

  public getFileUrl(filename: string, subfolder?: string): string {
    return subfolder
      ? `${this.cdnBaseUrl}/${subfolder}/${filename}`
      : `${this.cdnBaseUrl}/${filename}`;
  }
}

export const cloudStorageProvider = new CloudStorageProvider();

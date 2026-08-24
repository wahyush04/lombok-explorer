import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { StoredFileDto } from '../dto/storage.dto';
import { IStorageProvider, UploadFileInput } from './storage-provider.interface';
import { logger } from '../../../common/utils/logger';

export class LocalStorageProvider implements IStorageProvider {
  private readonly baseDir: string;
  private readonly publicUrlPrefix: string;

  constructor(
    baseDir: string = path.join(process.cwd(), 'assets', 'image'),
    publicUrlPrefix: string = '/assets/image',
  ) {
    this.baseDir = baseDir;
    this.publicUrlPrefix = publicUrlPrefix;
    this.ensureDirectoryExists(this.baseDir);
  }

  public getProviderName(): string {
    return 'LocalStorage';
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private sanitizeFilename(originalname: string): string {
    const ext = path.extname(originalname).toLowerCase();
    const uniqueId = crypto.randomUUID();
    return `${uniqueId}${ext}`;
  }

  public async saveFile(file: UploadFileInput, subfolder?: string): Promise<StoredFileDto> {
    const targetDir = subfolder ? path.join(this.baseDir, subfolder) : this.baseDir;
    this.ensureDirectoryExists(targetDir);

    const filename = this.sanitizeFilename(file.originalname);
    const destinationPath = path.join(targetDir, filename);

    await fs.promises.writeFile(destinationPath, file.buffer);

    const relativeUrl = subfolder
      ? `${this.publicUrlPrefix}/${subfolder}/${filename}`
      : `${this.publicUrlPrefix}/${filename}`;

    const size = file.size ?? file.buffer.length;

    return {
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size,
      url: relativeUrl,
      path: destinationPath,
      provider: this.getProviderName(),
    };
  }

  public async deleteFile(fileUrlOrName: string): Promise<boolean> {
    try {
      let relativePath = fileUrlOrName;
      if (relativePath.startsWith(this.publicUrlPrefix)) {
        relativePath = relativePath.substring(this.publicUrlPrefix.length);
      }

      // Remove leading slash
      if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
        relativePath = relativePath.substring(1);
      }

      const filePath = path.join(this.baseDir, relativePath);

      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        return true;
      }
      return false;
    } catch (error) {
      logger.warn({ error, fileUrlOrName }, 'Failed to delete local file');
      return false;
    }
  }

  public getFileUrl(filename: string, subfolder?: string): string {
    return subfolder
      ? `${this.publicUrlPrefix}/${subfolder}/${filename}`
      : `${this.publicUrlPrefix}/${filename}`;
  }
}

export const localStorageProvider = new LocalStorageProvider();

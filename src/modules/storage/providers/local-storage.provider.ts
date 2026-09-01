import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ImageVariant, StoredMediaDto, UploadMediaOptions } from '../dto/storage.dto';
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
    const targetDir = subfolder ? path.join(this.baseDir, subfolder) : this.baseDir;
    this.ensureDirectoryExists(targetDir);

    const filename = this.sanitizeFilename(file.originalname);
    const destinationPath = path.join(targetDir, filename);

    await fs.promises.writeFile(destinationPath, file.buffer);

    const relativeUrl = subfolder
      ? `${this.publicUrlPrefix}/${subfolder}/${filename}`
      : `${this.publicUrlPrefix}/${filename}`;

    const size = file.size ?? file.buffer.length;
    const publicId = subfolder ? `${subfolder}/${filename}` : filename;

    return {
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size,
      url: relativeUrl,
      secureUrl: relativeUrl,
      publicId,
      provider: this.getProviderName(),
      variants: {
        thumbnail: relativeUrl,
        card: relativeUrl,
        cover: relativeUrl,
      },
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
      ? `${this.publicUrlPrefix}/${subfolder}/${filename}`
      : `${this.publicUrlPrefix}/${filename}`;
  }
}

export const localStorageProvider = new LocalStorageProvider();

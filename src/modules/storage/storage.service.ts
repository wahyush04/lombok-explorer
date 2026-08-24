import { BadRequestError } from '../../common/errors/app-error';
import { StoredFileDto } from './dto/storage.dto';
import { IStorageProvider, localStorageProvider, UploadFileInput } from './providers';

export class StorageService {
  private provider: IStorageProvider;

  constructor(provider: IStorageProvider = localStorageProvider) {
    this.provider = provider;
  }

  /**
   * Allows hot-swapping between LocalStorageProvider and CloudStorageProvider.
   */
  public setProvider(provider: IStorageProvider): void {
    this.provider = provider;
  }

  public getActiveProviderName(): string {
    return this.provider.getProviderName();
  }

  public async uploadFile(file: UploadFileInput, subfolder?: string): Promise<StoredFileDto> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestError('No valid file uploaded or file is empty', 'FILE_UPLOAD_EMPTY');
    }

    return this.provider.saveFile(file, subfolder);
  }

  public async uploadMultipleFiles(
    files: UploadFileInput[],
    subfolder?: string,
  ): Promise<StoredFileDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestError('No files uploaded', 'FILE_UPLOAD_EMPTY');
    }

    const uploadPromises = files.map((file) => this.provider.saveFile(file, subfolder));
    return Promise.all(uploadPromises);
  }

  public async deleteFile(fileUrlOrName: string): Promise<boolean> {
    if (!fileUrlOrName) {
      throw new BadRequestError('File URL or name is required for deletion', 'INVALID_FILE_PARAM');
    }

    return this.provider.deleteFile(fileUrlOrName);
  }

  public getFileUrl(filename: string, subfolder?: string): string {
    return this.provider.getFileUrl(filename, subfolder);
  }
}

export const storageService = new StorageService();

import { StoredFileDto } from '../dto/storage.dto';

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
  saveFile(file: UploadFileInput, subfolder?: string): Promise<StoredFileDto>;

  /**
   * Deletes a stored file by its URL or relative filename.
   */
  deleteFile(fileUrlOrName: string): Promise<boolean>;

  /**
   * Resolves the public accessible URL for a given filename.
   */
  getFileUrl(filename: string, subfolder?: string): string;

  /**
   * Returns provider identifier (e.g. LocalStorage, CloudStorage).
   */
  getProviderName(): string;
}

import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { storageService, StorageService } from './storage.service';
import { BadRequestError } from '../../common/errors/app-error';

export class StorageController {
  constructor(private readonly service: StorageService = storageService) {}

  public uploadSingle = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new BadRequestError('No image file provided in "file" field', 'FILE_REQUIRED');
    }

    const subfolder = typeof req.query.folder === 'string' ? req.query.folder : undefined;
    const result = await this.service.uploadFile(req.file, subfolder);

    return ResponseUtil.sendCreated(res, result, 'Image uploaded successfully');
  });

  public uploadMultiple = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      throw new BadRequestError('No image files provided in "files" field', 'FILES_REQUIRED');
    }

    const subfolder = typeof req.query.folder === 'string' ? req.query.folder : undefined;
    const results = await this.service.uploadMultipleFiles(files, subfolder);

    return ResponseUtil.sendCreated(res, results, `${results.length} images uploaded successfully`);
  });

  public deleteFile = asyncHandler(async (req: Request, res: Response) => {
    const fileUrl = (req.body?.fileUrl || req.query?.fileUrl) as string | undefined;
    if (!fileUrl) {
      throw new BadRequestError('Parameter "fileUrl" is required', 'FILE_URL_REQUIRED');
    }

    const success = await this.service.deleteFile(fileUrl);
    return ResponseUtil.sendActionSuccess(
      res,
      success ? 'Image deleted successfully' : 'File not found or already deleted',
    );
  });
}

export const storageController = new StorageController();

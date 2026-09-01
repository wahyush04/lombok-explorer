import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { storageService, StorageService } from './storage.service';
import { BadRequestError } from '../../common/errors/app-error';
import { MediaUploadType, UploadMediaOptions } from './dto/storage.dto';

export class StorageController {
  constructor(private readonly service: StorageService = storageService) {}

  private extractUploadedFile(req: Request): Express.Multer.File | undefined {
    if (req.file) {
      return req.file;
    }

    if (req.files && typeof req.files === 'object' && !Array.isArray(req.files)) {
      const filesMap = req.files as Record<string, Express.Multer.File[]>;
      const possibleFields = ['file', 'image', 'avatar', 'cover'];
      for (const field of possibleFields) {
        if (filesMap[field] && filesMap[field].length > 0) {
          return filesMap[field][0];
        }
      }
    }

    return undefined;
  }

  public uploadSingle = asyncHandler(async (req: Request, res: Response) => {
    const file = this.extractUploadedFile(req);
    if (!file) {
      throw new BadRequestError(
        'No image file provided in "file" or "image" field',
        'FILE_REQUIRED',
      );
    }

    const type = (req.body?.type || req.query?.type) as MediaUploadType | undefined;
    const entityId = (req.body?.entityId || req.query?.entityId) as string | undefined;
    const folder = (req.body?.folder || req.query?.folder) as string | undefined;

    const options: UploadMediaOptions = {
      type,
      entityId,
      folder,
    };

    const result = await this.service.uploadImage(file, options);
    return ResponseUtil.sendCreated(res, result, 'Image uploaded successfully');
  });

  public uploadMultiple = asyncHandler(async (req: Request, res: Response) => {
    let files: Express.Multer.File[] = [];

    if (Array.isArray(req.files)) {
      files = req.files;
    } else if (req.files && typeof req.files === 'object') {
      const filesMap = req.files as Record<string, Express.Multer.File[]>;
      for (const key of Object.keys(filesMap)) {
        const itemFiles = filesMap[key];
        if (Array.isArray(itemFiles)) {
          files.push(...itemFiles);
        }
      }
    }

    if (files.length === 0) {
      throw new BadRequestError('No image files provided in "files" field', 'FILES_REQUIRED');
    }

    const type = (req.body?.type || req.query?.type) as MediaUploadType | undefined;
    const entityId = (req.body?.entityId || req.query?.entityId) as string | undefined;
    const folder = (req.body?.folder || req.query?.folder) as string | undefined;

    const options: UploadMediaOptions = {
      type,
      entityId,
      folder,
    };

    const results = await this.service.uploadMultipleImages(files, options);
    return ResponseUtil.sendCreated(res, results, `${results.length} images uploaded successfully`);
  });

  public deleteFile = asyncHandler(async (req: Request, res: Response) => {
    const target = (req.body?.publicId ||
      req.query?.publicId ||
      req.body?.fileUrl ||
      req.query?.fileUrl) as string | undefined;

    if (!target) {
      throw new BadRequestError(
        'Parameter "publicId" or "fileUrl" is required',
        'FILE_PARAM_REQUIRED',
      );
    }

    const success = await this.service.deleteImage(target);
    return ResponseUtil.sendActionSuccess(
      res,
      success ? 'Image deleted successfully' : 'File not found or already deleted',
    );
  });
}

export const storageController = new StorageController();
export const mediaController = storageController;

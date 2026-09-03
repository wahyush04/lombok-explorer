import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { cloudinaryService, CloudinaryService } from '../cloudinary/cloudinary.service';
import { UnauthorizedError } from '../../common/errors/app-error';

export class UploadsController {
  constructor(private readonly service: CloudinaryService = cloudinaryService) {}

  public getSignature = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('Authentication required to request upload signature', 'AUTH_REQUIRED');
    }

    const folderType = (req.body?.folder || req.query?.folder || 'feeds') as string;
    const signatureData = this.service.generateSignedUploadParams(userId, folderType);

    return ResponseUtil.sendSuccess(
      res,
      signatureData,
      'Upload signature generated successfully',
      200,
    );
  });
}

export const uploadsController = new UploadsController();

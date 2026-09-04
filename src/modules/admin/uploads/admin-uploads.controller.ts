import { Request, Response } from 'express';
import { cloudinaryService, CloudinaryService } from '../../cloudinary/cloudinary.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import { AdminUploadSignatureRequest } from './dto/admin-uploads.dto';

export class AdminUploadsController {
  constructor(private readonly cloudinary: CloudinaryService = cloudinaryService) {}

  public generateSignature = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as AdminUploadSignatureRequest;
    const adminId = req.user?.userId;

    const signatureData = this.cloudinary.generateAdminSignedUploadParams(
      adminId as string,
      body.resourceType,
      body.resourceId,
    );

    ResponseUtil.sendSuccess(res, signatureData, 'Upload signature generated successfully');
  };
}

export const adminUploadsController = new AdminUploadsController();

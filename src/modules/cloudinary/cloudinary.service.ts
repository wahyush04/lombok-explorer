import crypto from 'node:crypto';
import { cloudinary, isCloudinaryConfigured } from './cloudinary.config';
import { config } from '../../config/config';
import { logger } from '../../common/utils/logger';
import {
  BadRequestError,
  ForbiddenError,
  InternalServerError,
} from '../../common/errors/app-error';
import { SignedUploadParamsDto } from './cloudinary.types';
import {
  AdminSignedUploadParamsDto,
  AdminUploadResourceType,
} from '../admin/uploads/dto/admin-uploads.dto';

const RESOURCE_FOLDER_MAP: Record<AdminUploadResourceType, string> = {
  DESTINATION: 'destinations',
  DESTINATION_IMAGE: 'destinations',
  RESTAURANT: 'restaurants',
  ACCOMMODATION: 'accommodations',
  ITINERARY_TEMPLATE: 'itinerary-templates',
  CATEGORY: 'categories',
  USER: 'users',
  USER_AVATAR: 'users',
  REVIEW: 'reviews',
  FEED: 'feeds',
};

export class CloudinaryService {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly rootFolder: string;

  constructor() {
    this.cloudName = config.cloudinary.cloudName || '';
    this.apiKey = config.cloudinary.apiKey || '';
    this.apiSecret = config.cloudinary.apiSecret || '';
    this.rootFolder = config.cloudinary.folder || 'lombok-explorer';
  }

  /**
   * Generates signed upload parameters for Cloudinary direct client upload.
   * Forces folder isolation to: lombok-explorer/feeds/{userId}/{uuid}
   */
  public generateSignedUploadParams(
    userId: string,
    folderType: string = 'feeds',
  ): SignedUploadParamsDto {
    if (!isCloudinaryConfigured || !this.apiSecret) {
      throw new InternalServerError(
        'Cloudinary service is not configured on server',
        'CLOUDINARY_NOT_CONFIGURED',
      );
    }

    if (!userId) {
      throw new BadRequestError(
        'User ID is required to generate upload signature',
        'USER_ID_REQUIRED',
      );
    }

    // Generate unique session UUID for this upload batch
    const uploadSessionId = crypto.randomUUID();

    // Force secure folder structure per user
    let normalizedFolder: string;
    const cleanFolderType = folderType.toLowerCase().trim();

    if (cleanFolderType === 'feeds' || cleanFolderType === 'feed') {
      normalizedFolder = `${this.rootFolder}/feeds/${userId}/${uploadSessionId}`;
    } else if (cleanFolderType === 'users' || cleanFolderType === 'profile') {
      normalizedFolder = `${this.rootFolder}/users/${userId}`;
    } else if (cleanFolderType === 'destinations') {
      normalizedFolder = `${this.rootFolder}/destinations/${uploadSessionId}`;
    } else {
      normalizedFolder = `${this.rootFolder}/feeds/${userId}/${uploadSessionId}`;
    }

    const timestamp = Math.round(Date.now() / 1000);

    // Parameters to sign must be sorted alphabetically by Cloudinary SDK internally
    const paramsToSign = {
      folder: normalizedFolder,
      timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, this.apiSecret);
    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;

    logger.debug(
      { userId, folder: normalizedFolder, timestamp },
      '🔐 Generated Cloudinary Signed Upload Signature',
    );

    return {
      cloudName: this.cloudName,
      apiKey: this.apiKey,
      timestamp,
      signature,
      folder: normalizedFolder,
      uploadUrl,
    };
  }

  /**
   * Generates signed upload parameters specifically for Admin CMS operations.
   * Isolates folder to:
   * Create: {rootFolder}/admin/{adminId}/{resourceFolder}/{uploadSessionId}
   * Update: {rootFolder}/admin/{adminId}/{resourceFolder}/{resourceId}/{uploadSessionId}
   */
  public generateAdminSignedUploadParams(
    adminId: string,
    resourceType: AdminUploadResourceType,
    resourceId?: string,
  ): AdminSignedUploadParamsDto {
    if (!isCloudinaryConfigured || !this.apiSecret) {
      throw new InternalServerError(
        'Cloudinary service is not configured on server',
        'CLOUDINARY_NOT_CONFIGURED',
      );
    }

    if (!adminId) {
      throw new BadRequestError(
        'Admin ID is required to generate upload signature',
        'ADMIN_ID_REQUIRED',
      );
    }

    const folderName = RESOURCE_FOLDER_MAP[resourceType] || resourceType.toLowerCase();
    const uploadSessionId = crypto.randomUUID();

    let normalizedFolder: string;
    if (resourceId && resourceId.trim().length > 0) {
      normalizedFolder = `${this.rootFolder}/admin/${adminId}/${folderName}/${resourceId.trim()}/${uploadSessionId}`;
    } else {
      normalizedFolder = `${this.rootFolder}/admin/${adminId}/${folderName}/${uploadSessionId}`;
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = {
      folder: normalizedFolder,
      timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, this.apiSecret);
    const uploadUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;

    logger.debug(
      { adminId, resourceType, resourceId, folder: normalizedFolder, timestamp },
      '🔐 Generated Admin Cloudinary Signed Upload Signature',
    );

    return {
      cloudName: this.cloudName,
      apiKey: this.apiKey,
      timestamp,
      signature,
      folder: normalizedFolder,
      uploadUrl,
      uploadSessionId,
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      resourceType,
      resourceId,
    };
  }

  /**
   * Validates that the publicId belongs to the authenticated user and matches expected folder hierarchy.
   */
  public validateAssetOwnership(publicId: string, expectedUserId: string): boolean {
    if (!publicId || typeof publicId !== 'string') {
      throw new BadRequestError('Invalid or empty image publicId', 'INVALID_PUBLIC_ID');
    }

    // Expected pattern: (optional root/)feeds/{userId}/{uuid}/{image_id}
    const expectedPrefix = `${this.rootFolder}/feeds/${expectedUserId}/`;
    const fallbackPrefix = `feeds/${expectedUserId}/`;

    const isValidUserAsset =
      publicId.startsWith(expectedPrefix) || publicId.startsWith(fallbackPrefix);

    if (!isValidUserAsset) {
      logger.warn(
        { publicId, expectedUserId, expectedPrefix },
        '⛔ Security Violation: User attempted to use a Cloudinary asset not belonging to their folder',
      );
      throw new ForbiddenError(
        'You are not authorized to use or link this image asset',
        'UNAUTHORIZED_ASSET_ACCESS',
      );
    }

    return true;
  }

  /**
   * Validates that the publicId belongs to the authenticated admin and matches expected folder hierarchy.
   */
  public validateAdminAssetOwnership(
    publicId: string,
    expectedAdminId: string,
    resourceType?: AdminUploadResourceType,
  ): boolean {
    if (!publicId || typeof publicId !== 'string') {
      throw new BadRequestError('Invalid or empty image publicId', 'INVALID_PUBLIC_ID');
    }

    const folderName = resourceType ? RESOURCE_FOLDER_MAP[resourceType] : '';
    const adminRootWithFolder = folderName
      ? `${this.rootFolder}/admin/${expectedAdminId}/${folderName}/`
      : `${this.rootFolder}/admin/${expectedAdminId}/`;
    const fallbackAdminRootWithFolder = folderName
      ? `admin/${expectedAdminId}/${folderName}/`
      : `admin/${expectedAdminId}/`;

    // 1. If publicId is in an admin-isolated folder (/admin/), verify it belongs to this admin
    const isInAdminFolder = publicId.includes('/admin/') || publicId.startsWith('admin/');
    if (isInAdminFolder) {
      const isOwnedByAdmin =
        publicId.startsWith(adminRootWithFolder) ||
        publicId.startsWith(fallbackAdminRootWithFolder) ||
        publicId.startsWith(`${this.rootFolder}/admin/${expectedAdminId}/`) ||
        publicId.startsWith(`admin/${expectedAdminId}/`);

      if (!isOwnedByAdmin) {
        logger.warn(
          { publicId, expectedAdminId, resourceType, adminRootWithFolder },
          '⛔ Security Violation: Admin attempted to use a Cloudinary asset belonging to another admin folder',
        );
        throw new ForbiddenError(
          'You are not authorized to use or link this image asset',
          'UNAUTHORIZED_ASSET_ACCESS',
        );
      }
      return true;
    }

    // 2. Reject linking standard traveler user feed assets to CMS resources
    const isInFeedsFolder = publicId.includes('/feeds/') || publicId.startsWith('feeds/');
    if (isInFeedsFolder) {
      logger.warn(
        { publicId, expectedAdminId, resourceType },
        '⛔ Security Violation: Attempted to link user feed asset to admin CMS resource',
      );
      throw new ForbiddenError(
        'You are not authorized to use or link this image asset',
        'UNAUTHORIZED_ASSET_ACCESS',
      );
    }

    // 3. Standard / legacy / seeded master assets (e.g. categories/beach, lombok-explorer/categories/beach) are permitted
    return true;
  }

  /**
   * Deletes a single image asset from Cloudinary using publicId.
   */
  public async deleteAsset(publicId: string): Promise<boolean> {
    if (!publicId) return false;

    if (!isCloudinaryConfigured) {
      logger.warn({ publicId }, 'Cannot delete Cloudinary asset: Cloudinary not configured');
      return true;
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });

      if (result.result === 'ok' || result.result === 'not found') {
        logger.info(
          { publicId, result: result.result },
          '🗑️ Cloudinary asset deleted successfully',
        );
        return true;
      }

      logger.warn({ publicId, result }, 'Cloudinary destroy returned non-ok result');
      return false;
    } catch (err) {
      logger.error({ err, publicId }, 'Error deleting asset from Cloudinary');
      return false;
    }
  }

  /**
   * Concurrently deletes multiple assets from Cloudinary.
   * Used for post deletion and transaction rollback cleanup.
   */
  public async deleteMultipleAssets(publicIds: (string | null | undefined)[]): Promise<void> {
    const validPublicIds = (publicIds || []).filter((id): id is string =>
      Boolean(id && typeof id === 'string' && id.trim().length > 0),
    );
    if (validPublicIds.length === 0) return;

    logger.info(
      { count: validPublicIds.length, publicIds: validPublicIds },
      '🧹 Cleaning up Cloudinary assets',
    );

    const deletePromises = validPublicIds.map(async (publicId) => {
      try {
        await this.deleteAsset(publicId);
      } catch (err) {
        logger.warn({ err, publicId }, 'Failed to delete Cloudinary asset during bulk cleanup');
      }
    });

    await Promise.allSettled(deletePromises);
  }

  public async deleteAssets(publicIds: (string | null | undefined)[]): Promise<void> {
    return this.deleteMultipleAssets(publicIds);
  }
}

export const cloudinaryService = new CloudinaryService();

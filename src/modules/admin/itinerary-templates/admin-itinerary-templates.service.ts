import { NotFoundError } from '../../../common/errors/app-error';
import { PaginationMeta } from '../../../common/types';
import {
  AdminTemplateFilterQuery,
  CreateItineraryTemplateInput,
  UpdateItineraryTemplateInput,
} from './dto/admin-itinerary-template.dto';
import {
  AdminItineraryTemplatesRepository,
  adminItineraryTemplatesRepository,
} from './admin-itinerary-templates.repository';
import { cloudinaryService, CloudinaryService } from '../../cloudinary/cloudinary.service';
import { logger } from '../../../common/utils/logger';

export class AdminItineraryTemplatesService {
  constructor(
    private readonly repository: AdminItineraryTemplatesRepository = adminItineraryTemplatesRepository,
    private readonly cloudinary: CloudinaryService = cloudinaryService,
  ) {}

  public async getTemplates(query: AdminTemplateFilterQuery): Promise<{
    data: unknown[];
    meta: PaginationMeta;
  }> {
    const { items, total } = await this.repository.findMany(query);
    const totalPages = Math.ceil(total / query.limit) || 1;

    return {
      data: items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  public async getTemplateById(id: string): Promise<any> {
    const template = await this.repository.findById(id);
    if (!template) {
      throw new NotFoundError(`Itinerary template with ID '${id}' not found`, 'TEMPLATE_NOT_FOUND');
    }
    return template;
  }

  public async createTemplate(
    data: CreateItineraryTemplateInput,
    adminUserId?: string,
  ): Promise<unknown> {
    let coverImageUrl = data.coverImageUrl;
    let coverImagePublicId: string | null = null;

    if (data.coverImage && typeof data.coverImage === 'object') {
      coverImageUrl = data.coverImage.secureUrl;
      coverImagePublicId = data.coverImage.publicId;
      if (adminUserId && coverImagePublicId) {
        this.cloudinary.validateAdminAssetOwnership(
          coverImagePublicId,
          adminUserId,
          'ITINERARY_TEMPLATE',
        );
      }
    }

    try {
      const { coverImage, ...rest } = data;
      return await this.repository.create({
        ...rest,
        coverImageUrl,
        coverImagePublicId,
      } as any);
    } catch (error) {
      if (coverImagePublicId) {
        logger.warn(
          { coverImagePublicId, error },
          'Rolling back Cloudinary asset due to ItineraryTemplate create failure',
        );
        await this.cloudinary.deleteAsset(coverImagePublicId).catch(() => {});
      }
      throw error;
    }
  }

  public async updateTemplate(
    id: string,
    data: UpdateItineraryTemplateInput,
    adminUserId?: string,
  ): Promise<unknown> {
    const existing = await this.getTemplateById(id);

    let coverImageUrl = data.coverImageUrl;
    let coverImagePublicId: string | null | undefined = undefined;
    let newPublicId: string | null = null;

    if (data.coverImage && typeof data.coverImage === 'object') {
      coverImageUrl = data.coverImage.secureUrl;
      coverImagePublicId = data.coverImage.publicId;
      newPublicId = data.coverImage.publicId;
      if (adminUserId && newPublicId && newPublicId !== existing.coverImagePublicId) {
        this.cloudinary.validateAdminAssetOwnership(newPublicId, adminUserId, 'ITINERARY_TEMPLATE');
      }
    }

    try {
      const { coverImage, ...rest } = data;
      const updated = await this.repository.update(id, {
        ...rest,
        ...(coverImageUrl !== undefined && { coverImageUrl }),
        ...(coverImagePublicId !== undefined && { coverImagePublicId }),
      } as any);

      // Post-commit cleanup of old cover asset
      if (
        newPublicId &&
        existing.coverImagePublicId &&
        existing.coverImagePublicId !== newPublicId
      ) {
        this.cloudinary.deleteAsset(existing.coverImagePublicId).catch((err) => {
          logger.warn(
            { err, oldPublicId: existing.coverImagePublicId },
            'Failed to delete replaced template cover asset',
          );
        });
      }

      return updated;
    } catch (error) {
      if (newPublicId) {
        logger.warn(
          { newPublicId, error },
          'Rolling back Cloudinary asset due to ItineraryTemplate update failure',
        );
        await this.cloudinary.deleteAsset(newPublicId).catch(() => {});
      }
      throw error;
    }
  }

  public async deleteTemplate(id: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.getTemplateById(id);
    await this.repository.delete(id);
    if (existing.coverImagePublicId) {
      this.cloudinary.deleteAsset(existing.coverImagePublicId).catch(() => {});
    }
    return { success: true, message: 'Itinerary template deleted successfully' };
  }
}

export const adminItineraryTemplatesService = new AdminItineraryTemplatesService();

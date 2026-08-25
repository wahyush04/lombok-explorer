import { ReviewStatus } from '@prisma/client';
import {
  adminReviewsRepository,
  AdminReviewsRepository,
  ReviewWithUserAndDestination,
} from './admin-reviews.repository';
import {
  AdminReviewDto,
  AdminReviewFilterQuery,
  ReviewModerationDto,
} from './dto/admin-review.dto';
import { NotFoundError } from '../../../common/errors/app-error';
import { adminAuditLogsService } from '../audit-logs/admin-audit-logs.service';

export class AdminReviewsService {
  constructor(private readonly repository: AdminReviewsRepository = adminReviewsRepository) {}

  public async getReviews(query: AdminReviewFilterQuery): Promise<{
    items: AdminReviewDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const { items, total } = await this.repository.findMany(query);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items.map((r) => this.mapToAdminDto(r)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  public async getReviewById(id: string): Promise<AdminReviewDto> {
    const review = await this.repository.findById(id);
    if (!review) {
      throw new NotFoundError(`Review with ID '${id}' not found`, 'REVIEW_NOT_FOUND');
    }
    return this.mapToAdminDto(review);
  }

  public async moderateReview(
    id: string,
    data: ReviewModerationDto,
    adminId?: string,
  ): Promise<AdminReviewDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Review with ID '${id}' not found`, 'REVIEW_NOT_FOUND');
    }

    const previousStatus = existing.status;
    await this.repository.updateStatus(id, data.status);

    // Recalculate destination rating when approval status changes
    await this.repository.recalculateDestinationRating(existing.destinationId);

    // Audit log
    await adminAuditLogsService.recordLog({
      userId: adminId,
      action: data.status === ReviewStatus.APPROVED ? 'REVIEW_APPROVED' : 'REVIEW_REJECTED',
      entity: 'Review',
      entityId: id,
      oldValues: { status: previousStatus },
      newValues: {
        status: data.status,
        moderationNotes: data.moderationNotes,
        reason: data.reason,
      },
      details: {
        destinationId: existing.destinationId,
        authorId: existing.userId,
      },
    });

    const refreshed = await this.repository.findById(id);
    return this.mapToAdminDto(refreshed || existing);
  }

  public async deleteReview(id: string, adminId?: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Review with ID '${id}' not found`, 'REVIEW_NOT_FOUND');
    }

    await this.repository.delete(id);
    await this.repository.recalculateDestinationRating(existing.destinationId);

    // Audit log
    await adminAuditLogsService.recordLog({
      userId: adminId,
      action: 'REVIEW_DELETED',
      entity: 'Review',
      entityId: id,
      oldValues: {
        id: existing.id,
        rating: existing.rating,
        content: existing.content,
        status: existing.status,
      },
      details: {
        destinationId: existing.destinationId,
        authorId: existing.userId,
      },
    });
  }

  private mapToAdminDto(item: ReviewWithUserAndDestination): AdminReviewDto {
    let photos: string[] = [];
    if (item.photos) {
      try {
        photos = JSON.parse(item.photos);
      } catch {
        photos = [item.photos];
      }
    }

    return {
      id: item.id,
      userId: item.userId,
      user: item.user
        ? {
            id: item.user.id,
            name: item.user.name,
            email: item.user.email,
            avatarUrl: item.user.avatarUrl,
          }
        : null,
      destinationId: item.destinationId,
      destination: item.destination
        ? {
            id: item.destination.id,
            name: item.destination.name,
            slug: item.destination.slug,
            locationName: item.destination.locationName,
          }
        : null,
      rating: item.rating,
      content: item.content,
      photos,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}

export const adminReviewsService = new AdminReviewsService();

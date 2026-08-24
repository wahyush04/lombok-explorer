import { Review } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { reviewsRepository, ReviewsRepository } from './reviews.repository';
import {
  destinationsRepository,
  DestinationsRepository,
} from '../destinations/destinations.repository';
import { CreateReviewDto, ReviewDto, ReviewQuery, UpdateReviewDto } from './dto/review.dto';
import { PaginationMeta } from '../../common/types';

export type ReviewWithUser = Review & {
  user?: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
};

export class ReviewsService {
  constructor(
    private readonly repository: ReviewsRepository = reviewsRepository,
    private readonly destRepository: DestinationsRepository = destinationsRepository,
  ) {}

  private parsePhotos(photosJson: string | null | undefined): string[] {
    if (!photosJson) return [];
    try {
      const parsed = JSON.parse(photosJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return photosJson ? [photosJson] : [];
    }
  }

  public mapToDto(review: ReviewWithUser): ReviewDto {
    return {
      id: review.id,
      userId: review.userId,
      destinationId: review.destinationId,
      rating: review.rating,
      content: review.content,
      photos: this.parsePhotos(review.photos),
      user: {
        id: review.user?.id || review.userId,
        name: review.user?.name || 'Anonymous Traveler',
        avatarUrl: review.user?.avatarUrl || null,
      },
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }

  public async getDestinationReviews(
    destinationIdOrSlug: string,
    query: ReviewQuery,
  ): Promise<{ data: ReviewDto[]; meta: PaginationMeta }> {
    const destination = await this.destRepository.findByIdOrSlug(destinationIdOrSlug);
    if (!destination) {
      throw new NotFoundError(
        `Destination '${destinationIdOrSlug}' not found`,
        'DESTINATION_NOT_FOUND',
      );
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const sortBy = query.sort_by || 'newest';

    const { items, total } = await this.repository.findManyByDestination(
      destination.id,
      page,
      limit,
      sortBy,
    );

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: items.map((item: ReviewWithUser) => this.mapToDto(item)),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  public async createDestinationReview(
    userId: string,
    destinationIdOrSlug: string,
    dto: CreateReviewDto,
  ): Promise<ReviewDto> {
    const destination = await this.destRepository.findByIdOrSlug(destinationIdOrSlug);
    if (!destination) {
      throw new NotFoundError(
        `Destination '${destinationIdOrSlug}' not found`,
        'DESTINATION_NOT_FOUND',
      );
    }

    const photosJson = dto.photos && dto.photos.length > 0 ? JSON.stringify(dto.photos) : null;

    const created = await this.repository.create({
      userId,
      destinationId: destination.id,
      rating: dto.rating,
      content: dto.content,
      photos: photosJson,
    });

    // Efficiently recalculate destination average rating and total review count
    await this.repository.recalculateDestinationRating(destination.id);

    return this.mapToDto(created as ReviewWithUser);
  }

  public async updateReview(
    userId: string,
    userRole: string,
    reviewId: string,
    dto: UpdateReviewDto,
  ): Promise<ReviewDto> {
    const existing = await this.repository.findById(reviewId);
    if (!existing) {
      throw new NotFoundError(`Review '${reviewId}' not found`, 'REVIEW_NOT_FOUND');
    }

    // Ownership check: user can only edit their own reviews (or Admin)
    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to modify this review',
        'FORBIDDEN_RESOURCE',
      );
    }

    const updateData: { rating?: number; content?: string; photos?: string | null } = {};
    if (dto.rating !== undefined) updateData.rating = dto.rating;
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.photos !== undefined) {
      updateData.photos = dto.photos.length > 0 ? JSON.stringify(dto.photos) : null;
    }

    const updated = await this.repository.update(reviewId, updateData);

    // Recalculate destination rating
    if (dto.rating !== undefined) {
      await this.repository.recalculateDestinationRating(existing.destinationId);
    }

    return this.mapToDto(updated as ReviewWithUser);
  }

  public async deleteReview(userId: string, userRole: string, reviewId: string): Promise<void> {
    const existing = await this.repository.findById(reviewId);
    if (!existing) {
      throw new NotFoundError(`Review '${reviewId}' not found`, 'REVIEW_NOT_FOUND');
    }

    // Ownership check: user can only delete their own reviews (or Admin)
    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to delete this review',
        'FORBIDDEN_RESOURCE',
      );
    }

    await this.repository.delete(reviewId);

    // Recalculate destination rating and count
    await this.repository.recalculateDestinationRating(existing.destinationId);
  }
}

export const reviewsService = new ReviewsService();

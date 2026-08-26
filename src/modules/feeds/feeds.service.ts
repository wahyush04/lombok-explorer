import { prisma } from '../../database/prisma';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { CreatePostDto, FeedQueryDto, SearchDestinationQueryDto, UpdatePostDto } from './dto/feed-post.dto';
import { feedsRepository, FeedsRepository } from './feeds.repository';
import { FeedsMapper } from './feeds.mapper';
import { decodeCursor, encodeCursor } from './utils/cursor.util';
import { CursorPaginatedData, FeedPostResponse } from './feeds.types';

export class FeedsService {
  private readonly repository: FeedsRepository;

  constructor(repository: FeedsRepository = feedsRepository) {
    this.repository = repository;
  }

  /**
   * Retrieves public published posts using cursor-based pagination.
   */
  public async getFeeds(
    query: FeedQueryDto,
    viewerUserId?: string,
  ): Promise<CursorPaginatedData<FeedPostResponse>> {
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 20));
    const cursor = decodeCursor(query.cursor);

    const posts = await this.repository.findManyWithCursor({
      cursor,
      limit,
      destinationId: query.destinationId,
      userId: query.userId,
      status: 'PUBLISHED',
    });

    const hasNextPage = posts.length > limit;
    const items = hasNextPage ? posts.slice(0, limit) : posts;
    const lastItem = hasNextPage && items.length > 0 ? items[items.length - 1] : null;
    const nextCursor = lastItem ? encodeCursor(lastItem) : null;

    const postIds = items.map((p) => p.id);
    const interactionsMap = viewerUserId
      ? await this.repository.getUserInteractions(viewerUserId, postIds)
      : new Map();

    const mappedItems = items.map((post) =>
      FeedsMapper.toPostResponse(post, interactionsMap.get(post.id)),
    );

    return {
      items: mappedItems,
      pagination: {
        nextCursor,
        hasNextPage,
      },
    };
  }

  /**
   * Retrieves single post detail by ID.
   */
  public async getPostById(postId: string, viewerUserId?: string): Promise<FeedPostResponse> {
    const post = await this.repository.findById(postId);
    if (!post) {
      throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
    }

    const interactionsMap = viewerUserId
      ? await this.repository.getUserInteractions(viewerUserId, [postId])
      : new Map();

    return FeedsMapper.toPostResponse(post, interactionsMap.get(postId));
  }

  /**
   * Creates a new feed post.
   */
  public async createPost(userId: string, data: CreatePostDto): Promise<FeedPostResponse> {
    let destinationSnapshot: { name: string; latitude: number; longitude: number; address?: string | null } | null = null;

    if (data.destinationId) {
      const destination = await prisma.destination.findUnique({
        where: { id: data.destinationId },
        select: { id: true, name: true, latitude: true, longitude: true, address: true },
      });

      if (!destination) {
        throw new NotFoundError('Selected destination does not exist', 'DESTINATION_NOT_FOUND');
      }

      destinationSnapshot = {
        name: destination.name,
        latitude: destination.latitude,
        longitude: destination.longitude,
        address: destination.address,
      };
    }

    const createdPost = await this.repository.createPost(userId, data, destinationSnapshot);
    return FeedsMapper.toPostResponse(createdPost, { isLiked: false, isBookmarked: false });
  }

  /**
   * Updates an existing feed post (Ownership verified).
   */
  public async updatePost(
    postId: string,
    userId: string,
    userRole: string,
    data: UpdatePostDto,
  ): Promise<FeedPostResponse> {
    const existing = await this.repository.findById(postId);
    if (!existing) {
      throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
    }

    // Owner or Admin check
    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to edit this post', 'FORBIDDEN_RESOURCE');
    }

    let destinationSnapshot: { name: string; latitude: number; longitude: number; address?: string | null } | null = null;

    if (data.destinationId) {
      const destination = await prisma.destination.findUnique({
        where: { id: data.destinationId },
        select: { id: true, name: true, latitude: true, longitude: true, address: true },
      });

      if (!destination) {
        throw new NotFoundError('Selected destination does not exist', 'DESTINATION_NOT_FOUND');
      }

      destinationSnapshot = {
        name: destination.name,
        latitude: destination.latitude,
        longitude: destination.longitude,
        address: destination.address,
      };
    }

    const updatedPost = await this.repository.updatePost(postId, data, destinationSnapshot);
    const interactionsMap = await this.repository.getUserInteractions(userId, [postId]);

    return FeedsMapper.toPostResponse(updatedPost, interactionsMap.get(postId));
  }

  /**
   * Soft deletes a post (Ownership verified).
   */
  public async deletePost(postId: string, userId: string, userRole: string): Promise<void> {
    const existing = await this.repository.findById(postId);
    if (!existing) {
      throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
    }

    // Owner or Admin check
    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not have permission to delete this post', 'FORBIDDEN_RESOURCE');
    }

    await this.repository.softDeletePost(postId);
  }

  /**
   * Searches published destinations.
   */
  public async searchDestinations(query: SearchDestinationQueryDto) {
    return this.repository.searchDestinations(query.q || '', query.limit);
  }
}

export const feedsService = new FeedsService();

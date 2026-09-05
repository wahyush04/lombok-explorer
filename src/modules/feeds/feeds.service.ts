import { prisma } from '../../database/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import {
  CreatePostDto,
  FeedQueryDto,
  SearchDestinationQueryDto,
  UpdatePostDto,
} from './dto/feed-post.dto';
import { feedsRepository, FeedsRepository } from './feeds.repository';
import { FeedsMapper, PrismaPostWithRelations } from './feeds.mapper';
import { decodeCursor, encodeCursor } from './utils/cursor.util';
import { CursorPaginatedData, FeedPostResponse } from './feeds.types';
import { cloudinaryService, CloudinaryService } from '../cloudinary/cloudinary.service';
import { notificationsService, NotificationsService } from '../notifications/notifications.service';
import { logger } from '../../common/utils/logger';

export class FeedsService {
  private readonly repository: FeedsRepository;
  private readonly cloudinary: CloudinaryService;
  private readonly notifications: NotificationsService;

  constructor(
    repository: FeedsRepository = feedsRepository,
    cloudinary: CloudinaryService = cloudinaryService,
    notifications: NotificationsService = notificationsService,
  ) {
    this.repository = repository;
    this.cloudinary = cloudinary;
    this.notifications = notifications;
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
   * Retrieves public published posts for a specific user. Throws 404 if user not found.
   */
  public async getUserPosts(
    targetUserId: string,
    query: FeedQueryDto,
    viewerUserId?: string,
  ): Promise<CursorPaginatedData<FeedPostResponse>> {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }
    return this.getFeeds({ ...query, userId: targetUserId }, viewerUserId);
  }

  /**
   * Retrieves single post detail by ID.
   */
  public async getPostById(
    postId: string,
    viewerUserId?: string,
    userRole?: string,
  ): Promise<FeedPostResponse> {
    const post = await this.repository.findById(postId);
    if (!post) {
      throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
    }

    if (post.status !== 'PUBLISHED') {
      const isOwner = viewerUserId && post.userId === viewerUserId;
      const isAdmin = userRole === 'ADMIN';
      if (!isOwner && !isAdmin) {
        throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
      }
    }

    const interactionsMap = viewerUserId
      ? await this.repository.getUserInteractions(viewerUserId, [postId])
      : new Map();

    return FeedsMapper.toPostResponse(post, interactionsMap.get(postId));
  }

  /**
   * Creates a new feed post with verified Cloudinary image assets and atomic rollback cleanup.
   */
  public async createPost(userId: string, data: CreatePostDto): Promise<FeedPostResponse> {
    let destinationSnapshot: {
      name: string;
      latitude: number;
      longitude: number;
      address?: string | null;
    } | null = null;
    const destId = data.destinationId || data.location?.destinationId;

    const rawImages = data.images || data.media || [];

    // Validate Cloudinary asset ownership for all provided images
    for (const img of rawImages) {
      if (img.publicId) {
        this.cloudinary.validateAssetOwnership(img.publicId, userId);
      }
    }

    try {
      if (destId) {
        const destination = await prisma.destination.findUnique({
          where: { id: destId },
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

      if (rawImages.length === 0) {
        throw new BadRequestError(
          'At least one uploaded image is required to create a feed post',
          'IMAGES_REQUIRED',
        );
      }

      const createdPost = await this.repository.createPost(userId, data, destinationSnapshot);
      return FeedsMapper.toPostResponse(createdPost, { isLiked: false, isBookmarked: false });
    } catch (err) {
      // If database transaction or validation failed after image upload, cleanup Cloudinary assets immediately
      const publicIds = rawImages
        .map((img) => img.publicId)
        .filter((id): id is string => Boolean(id));

      if (publicIds.length > 0) {
        await this.cloudinary.deleteMultipleAssets(publicIds);
      }
      throw err;
    }
  }

  /**
   * Updates an existing feed post (Ownership verified) with support for adding, removing, and reordering images.
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
      throw new ForbiddenError(
        'You do not have permission to edit this post',
        'FORBIDDEN_RESOURCE',
      );
    }

    const rawImages = data.images !== undefined ? data.images : data.media;
    let removedPublicIds: string[] = [];

    if (rawImages !== undefined) {
      // Validate asset ownership for newly supplied images
      for (const img of rawImages) {
        if (img.publicId) {
          this.cloudinary.validateAssetOwnership(img.publicId, userId);
        }
      }

      // Identify images that were removed in this update
      const existingPublicIds = (existing.media || [])
        .map((m) => m.publicId)
        .filter((id): id is string => Boolean(id));
      const newPublicIdsSet = new Set(
        rawImages.map((m) => m.publicId).filter((id): id is string => Boolean(id)),
      );

      removedPublicIds = existingPublicIds.filter((pid) => !newPublicIdsSet.has(pid));
    }

    let destinationSnapshot: {
      name: string;
      latitude: number;
      longitude: number;
      address?: string | null;
    } | null = null;
    const destId = data.destinationId || data.location?.destinationId;

    if (destId) {
      const destination = await prisma.destination.findUnique({
        where: { id: destId },
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

    // Delete removed images from Cloudinary asynchronously
    if (removedPublicIds.length > 0) {
      await this.cloudinary.deleteMultipleAssets(removedPublicIds);
    }

    const interactionsMap = await this.repository.getUserInteractions(userId, [postId]);
    return FeedsMapper.toPostResponse(updatedPost, interactionsMap.get(postId));
  }

  /**
   * Deletes a post from database and cleans up linked Cloudinary assets (Ownership verified).
   */
  public async deletePost(postId: string, userId: string, userRole: string): Promise<void> {
    const existing = await this.repository.findById(postId);
    if (!existing) {
      throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
    }

    // Owner or Admin check
    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to delete this post',
        'FORBIDDEN_RESOURCE',
      );
    }

    // Collect all public IDs linked to this post before deletion
    const publicIds = (existing.media || [])
      .map((m) => m.publicId)
      .filter((id): id is string => Boolean(id));

    // Delete post from database
    await this.repository.deletePost(postId);

    // Clean up all Cloudinary assets
    if (publicIds.length > 0) {
      await this.cloudinary.deleteMultipleAssets(publicIds);
    }
  }

  /**
   * Searches published destinations.
   */
  public async searchDestinations(query: SearchDestinationQueryDto) {
    return this.repository.searchDestinations(query.q || '', query.limit);
  }

  /**
   * Likes a post (atomic + idempotent).
   */
  public async likePost(userId: string, postId: string) {
    try {
      const result = await this.repository.addLike(userId, postId);

      if (result.isNewlyLiked && result.postAuthorId && result.postAuthorId !== userId) {
        // Fetch actor details to generate dynamic notification text
        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, username: true },
        });

        const actorName = actor?.name || actor?.username || 'Seseorang';
        try {
          await this.notifications.createNotification({
            recipientId: result.postAuthorId,
            actorId: userId,
            type: 'POST_LIKED',
            postId,
            title: `${actorName} menyukai postingan Anda`,
            body: 'Ketuk untuk melihat postingan Anda',
            data: {
              postId,
              actorId: userId,
            },
          });
        } catch (err) {
          logger.error({ err, postId, userId }, 'Failed to create POST_LIKED notification');
        }
      }

      return { isLiked: result.isLiked, likeCount: result.likeCount };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'POST_NOT_FOUND') {
        throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
      }
      throw err;
    }
  }

  /**
   * Unlikes a post (atomic).
   */
  public async unlikePost(userId: string, postId: string) {
    try {
      return await this.repository.removeLike(userId, postId);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'POST_NOT_FOUND') {
        throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
      }
      throw err;
    }
  }

  /**
   * Retrieves cursor-paginated comments for a post.
   */
  public async getComments(
    postId: string,
    query: import('./dto/feed-comment.dto').CommentQueryDto,
  ) {
    // Verify post exists
    const post = await this.repository.findById(postId);
    if (!post) {
      throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
    }

    const limit = Math.max(1, Math.min(50, Number(query.limit) || 20));
    const cursor = decodeCursor(query.cursor);

    const comments = await this.repository.findCommentsWithCursor(postId, {
      cursor,
      limit,
      order: query.order,
    });

    const hasNextPage = comments.length > limit;
    const items = hasNextPage ? comments.slice(0, limit) : comments;
    const lastItem = hasNextPage && items.length > 0 ? items[items.length - 1] : null;
    const nextCursor = lastItem ? encodeCursor(lastItem) : null;

    const mappedItems = comments
      .slice(0, limit)
      .map((comment: import('./feeds.mapper').PrismaCommentWithUser) =>
        FeedsMapper.toCommentResponse(comment),
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
   * Creates a new comment on a post.
   */
  public async createComment(
    userId: string,
    postId: string,
    data: import('./dto/feed-comment.dto').CreateCommentDto,
  ) {
    try {
      const comment = await this.repository.createComment(userId, postId, data.content);

      if (comment.postAuthorId && comment.postAuthorId !== userId) {
        const actorName = comment.user?.name || comment.user?.username || 'Seseorang';
        const truncatedContent =
          comment.content.length > 80 ? `${comment.content.slice(0, 77)}...` : comment.content;

        try {
          await this.notifications.createNotification({
            recipientId: comment.postAuthorId,
            actorId: userId,
            type: 'POST_COMMENTED',
            postId,
            commentId: comment.id,
            title: `${actorName} mengomentari postingan Anda`,
            body: `"${truncatedContent}"`,
            data: {
              postId,
              commentId: comment.id,
              actorId: userId,
            },
          });
        } catch (err) {
          logger.error(
            { err, postId, commentId: comment.id, userId },
            'Failed to create POST_COMMENTED notification',
          );
        }
      }

      return FeedsMapper.toCommentResponse(comment);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'POST_NOT_FOUND') {
        throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
      }
      throw err;
    }
  }

  /**
   * Deletes a comment (comment author, post owner, or admin authorized).
   */
  public async deleteComment(commentId: string, userId: string, userRole: string): Promise<void> {
    const comment = await this.repository.findCommentById(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found', 'COMMENT_NOT_FOUND');
    }

    const isCommentAuthor = comment.userId === userId;
    const isPostOwner = comment.post?.userId === userId;
    const isAdmin = userRole === 'ADMIN';

    if (!isCommentAuthor && !isPostOwner && !isAdmin) {
      throw new ForbiddenError(
        'You do not have permission to delete this comment',
        'FORBIDDEN_RESOURCE',
      );
    }

    await this.repository.softDeleteComment(commentId, comment.postId);
  }

  /**
   * Bookmarks a post for a user.
   */
  public async bookmarkPost(userId: string, postId: string) {
    try {
      return await this.repository.addBookmark(userId, postId);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'POST_NOT_FOUND') {
        throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
      }
      throw err;
    }
  }

  /**
   * Removes bookmark from a post.
   */
  public async unbookmarkPost(userId: string, postId: string) {
    try {
      return await this.repository.removeBookmark(userId, postId);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'POST_NOT_FOUND') {
        throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
      }
      throw err;
    }
  }

  /**
   * Retrieves cursor-paginated bookmarked posts of a user.
   */
  public async getUserBookmarks(
    userId: string,
    query: import('./dto/feed-bookmark.dto').BookmarkQueryDto,
  ) {
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 20));
    const cursor = decodeCursor(query.cursor);

    const bookmarks = await this.repository.findBookmarkedPostsWithCursor(userId, {
      cursor,
      limit,
    });

    const hasNextPage = bookmarks.length > limit;
    const items = hasNextPage ? bookmarks.slice(0, limit) : bookmarks;
    const lastItem = hasNextPage && items.length > 0 ? items[items.length - 1] : null;
    const nextCursor = lastItem
      ? encodeCursor({ createdAt: lastItem.createdAt.toISOString(), id: lastItem.id })
      : null;

    const postIds = items.map((b: { post: { id: string } }) => b.post.id);
    const interactionsMap = await this.repository.getUserInteractions(userId, postIds);

    const mappedItems = items.map((b: { post: PrismaPostWithRelations }) => {
      const viewer = interactionsMap.get(b.post.id) || { isLiked: false, isBookmarked: true };
      viewer.isBookmarked = true;
      return FeedsMapper.toPostResponse(b.post, viewer);
    });

    return {
      items: mappedItems,
      pagination: {
        nextCursor,
        hasNextPage,
      },
    };
  }

  /**
   * Increments share count for a post.
   */
  public async sharePost(postId: string) {
    try {
      return await this.repository.incrementShareCount(postId);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'POST_NOT_FOUND') {
        throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
      }
      throw err;
    }
  }

  /**
   * Submits a report for a post.
   */
  public async reportPost(
    userId: string,
    postId: string,
    data: import('./dto/feed-report.dto').CreateReportDto,
  ) {
    try {
      const report = await this.repository.createReport(userId, postId, data);
      return {
        id: report.id,
        postId: report.postId,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'POST_NOT_FOUND') {
        throw new NotFoundError('Feed post not found', 'POST_NOT_FOUND');
      }
      throw err;
    }
  }
}

export const feedsService = new FeedsService();

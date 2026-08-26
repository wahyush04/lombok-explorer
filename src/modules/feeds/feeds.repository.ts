import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { CreatePostDto, UpdatePostDto } from './dto/feed-post.dto';
import { CursorPayload, FeedViewerResponse } from './feeds.types';
import { PrismaPostWithRelations } from './feeds.mapper';

export class FeedsRepository {
  private readonly defaultPostInclude = {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        avatarUrl: true,
      },
    },
    destination: {
      select: {
        id: true,
        name: true,
        slug: true,
        latitude: true,
        longitude: true,
        address: true,
      },
    },
    location: {
      include: {
        destination: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    },
    media: {
      orderBy: {
        sortOrder: 'asc' as const,
      },
    },
  };

  /**
   * Creates a new feed post along with optional location and media in an atomic transaction.
   */
  public async createPost(
    userId: string,
    data: CreatePostDto,
    destinationSnapshot?: { name: string; latitude: number; longitude: number; address?: string | null } | null,
  ): Promise<PrismaPostWithRelations> {
    return prisma.$transaction(async (tx) => {
      // Determine location snapshot fields
      const locName = data.location?.name || destinationSnapshot?.name || null;
      const lat = data.location?.latitude ?? destinationSnapshot?.latitude ?? null;
      const lng = data.location?.longitude ?? destinationSnapshot?.longitude ?? null;

      const post = await tx.post.create({
        data: {
          userId,
          title: data.title,
          description: data.description,
          destinationId: data.destinationId || null,
          locationName: locName,
          latitude: lat,
          longitude: lng,
          status: 'PUBLISHED',
          // Create nested PostLocation if location or destination is present
          ...(data.location || data.destinationId
            ? {
                location: {
                  create: {
                    name: data.location?.name || destinationSnapshot?.name || 'Lokasi Wisata',
                    latitude: data.location?.latitude ?? destinationSnapshot?.latitude ?? 0,
                    longitude: data.location?.longitude ?? destinationSnapshot?.longitude ?? 0,
                    address: data.location?.address || destinationSnapshot?.address || null,
                    destinationId: data.destinationId || null,
                  },
                },
              }
            : {}),
          // Create media items if provided
          ...(data.media && data.media.length > 0
            ? {
                media: {
                  create: data.media.map((item, index) => ({
                    url: item.url,
                    type: item.type || 'IMAGE',
                    sortOrder: item.sortOrder ?? index,
                    caption: item.caption || null,
                  })),
                },
              }
            : {}),
        },
        include: this.defaultPostInclude,
      });

      return post as PrismaPostWithRelations;
    });
  }

  /**
   * Finds a single post by ID.
   */
  public async findById(id: string, includeDeleted = false): Promise<PrismaPostWithRelations | null> {
    const post = await prisma.post.findFirst({
      where: {
        id,
        ...(includeDeleted
          ? {}
          : {
              deletedAt: null,
              status: { not: 'DELETED' },
            }),
      },
      include: this.defaultPostInclude,
    });

    return post as PrismaPostWithRelations | null;
  }

  /**
   * Finds multiple posts using deterministic cursor pagination.
   */
  public async findManyWithCursor(params: {
    cursor?: CursorPayload | null;
    limit: number;
    destinationId?: string;
    userId?: string;
    status?: 'PUBLISHED' | 'DRAFT' | 'HIDDEN' | 'DELETED';
    includeHidden?: boolean;
  }): Promise<PrismaPostWithRelations[]> {
    const limit = Math.max(1, Math.min(50, Number(params.limit) || 20));

    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      status: params.status || (params.includeHidden ? undefined : 'PUBLISHED'),
      ...(params.destinationId ? { destinationId: params.destinationId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
    };

    if (params.cursor) {
      const cursorDate = new Date(params.cursor.createdAt);
      const cursorId = params.cursor.id;

      where.AND = [
        {
          OR: [
            { createdAt: { lt: cursorDate } },
            {
              createdAt: cursorDate,
              id: { lt: cursorId },
            },
          ],
        },
      ];
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1, // Fetch limit + 1 to detect if next page exists
      include: this.defaultPostInclude,
    });

    return posts as PrismaPostWithRelations[];
  }

  /**
   * Updates an existing post and associated location/media in a transaction.
   */
  public async updatePost(
    id: string,
    data: UpdatePostDto,
    destinationSnapshot?: { name: string; latitude: number; longitude: number; address?: string | null } | null,
  ): Promise<PrismaPostWithRelations> {
    return prisma.$transaction(async (tx) => {
      // 1. Prepare base update data
      const updateData: Prisma.PostUpdateInput = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.destinationId !== undefined) {
        updateData.destination = data.destinationId
          ? { connect: { id: data.destinationId } }
          : { disconnect: true };
      }

      if (data.location !== undefined || data.destinationId !== undefined) {
        if (data.location) {
          updateData.locationName = data.location.name;
          updateData.latitude = data.location.latitude;
          updateData.longitude = data.location.longitude;
        } else if (destinationSnapshot) {
          updateData.locationName = destinationSnapshot.name;
          updateData.latitude = destinationSnapshot.latitude;
          updateData.longitude = destinationSnapshot.longitude;
        }
      }

      // 2. Handle location upsert
      if (data.location !== undefined) {
        if (data.location === null) {
          await tx.postLocation.deleteMany({ where: { postId: id } });
        } else {
          await tx.postLocation.upsert({
            where: { postId: id },
            create: {
              postId: id,
              name: data.location.name,
              latitude: data.location.latitude,
              longitude: data.location.longitude,
              address: data.location.address || null,
              destinationId: data.destinationId || null,
            },
            update: {
              name: data.location.name,
              latitude: data.location.latitude,
              longitude: data.location.longitude,
              address: data.location.address || null,
              destinationId: data.destinationId || null,
            },
          });
        }
      }

      // 3. Handle media updates if provided
      if (data.media !== undefined) {
        await tx.postMedia.deleteMany({ where: { postId: id } });
        if (data.media.length > 0) {
          await tx.postMedia.createMany({
            data: data.media.map((item, index) => ({
              postId: id,
              url: item.url,
              type: item.type || 'IMAGE',
              sortOrder: item.sortOrder ?? index,
              caption: item.caption || null,
            })),
          });
        }
      }

      // 4. Update post record
      const post = await tx.post.update({
        where: { id },
        data: updateData,
        include: this.defaultPostInclude,
      });

      return post as PrismaPostWithRelations;
    });
  }

  /**
   * Soft deletes a post.
   */
  public async softDeletePost(id: string): Promise<void> {
    await prisma.post.update({
      where: { id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Searches published destinations by query string.
   */
  public async searchDestinations(q: string, limit = 10) {
    return prisma.destination.findMany({
      where: {
        status: 'PUBLISHED',
        deletedAt: null,
        ...(q.trim()
          ? {
              OR: [
                { name: { contains: q.trim(), mode: 'insensitive' } },
                { locationName: { contains: q.trim(), mode: 'insensitive' } },
                { slug: { contains: q.trim().toLowerCase(), mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      take: Math.min(30, limit),
      orderBy: [{ rating: 'desc' }, { reviewCount: 'desc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        locationName: true,
        latitude: true,
        longitude: true,
        address: true,
        rating: true,
        coverImageUrl: true,
      },
    });
  }

  /**
   * Fetches viewer interaction states (likes, bookmarks) for multiple posts.
   */
  public async getUserInteractions(
    userId: string,
    postIds: string[],
  ): Promise<Map<string, FeedViewerResponse>> {
    const resultMap = new Map<string, FeedViewerResponse>();
    if (!userId || postIds.length === 0) {
      return resultMap;
    }

    const [likes, bookmarks] = await Promise.all([
      prisma.postLike.findMany({
        where: {
          userId,
          postId: { in: postIds },
        },
        select: { postId: true },
      }),
      prisma.postBookmark.findMany({
        where: {
          userId,
          postId: { in: postIds },
        },
        select: { postId: true },
      }),
    ]);

    const likedSet = new Set(likes.map((l: { postId: string }) => l.postId));
    const bookmarkedSet = new Set(bookmarks.map((b: { postId: string }) => b.postId));

    for (const postId of postIds) {
      resultMap.set(postId, {
        isLiked: likedSet.has(postId),
        isBookmarked: bookmarkedSet.has(postId),
      });
    }

    return resultMap;
  }

  /**
   * Adds like to post atomically and increments likeCount.
   */
  public async addLike(userId: string, postId: string): Promise<{ isLiked: boolean; likeCount: number }> {
    return prisma.$transaction(async (tx) => {
      const post = await tx.post.findFirst({
        where: { id: postId, deletedAt: null, status: { not: 'DELETED' } },
        select: { id: true, likeCount: true },
      });

      if (!post) {
        throw new Error('POST_NOT_FOUND');
      }

      const existingLike = await tx.postLike.findUnique({
        where: {
          userId_postId: { userId, postId },
        },
      });

      if (!existingLike) {
        await tx.postLike.create({
          data: { userId, postId },
        });

        const updated = await tx.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        });

        return { isLiked: true, likeCount: updated.likeCount };
      }

      return { isLiked: true, likeCount: post.likeCount };
    });
  }

  /**
   * Removes like from post atomically and decrements likeCount.
   */
  public async removeLike(userId: string, postId: string): Promise<{ isLiked: boolean; likeCount: number }> {
    return prisma.$transaction(async (tx) => {
      const post = await tx.post.findFirst({
        where: { id: postId, deletedAt: null, status: { not: 'DELETED' } },
        select: { id: true, likeCount: true },
      });

      if (!post) {
        throw new Error('POST_NOT_FOUND');
      }

      const existingLike = await tx.postLike.findUnique({
        where: {
          userId_postId: { userId, postId },
        },
      });

      if (existingLike) {
        await tx.postLike.delete({
          where: {
            userId_postId: { userId, postId },
          },
        });

        const currentCount = Math.max(0, post.likeCount - 1);
        const updated = await tx.post.update({
          where: { id: postId },
          data: { likeCount: currentCount },
          select: { likeCount: true },
        });

        return { isLiked: false, likeCount: updated.likeCount };
      }

      return { isLiked: false, likeCount: post.likeCount };
    });
  }

  /**
   * Creates a comment on a post atomically and increments commentCount.
   */
  public async createComment(userId: string, postId: string, content: string) {
    return prisma.$transaction(async (tx) => {
      const post = await tx.post.findFirst({
        where: { id: postId, deletedAt: null, status: { not: 'DELETED' } },
        select: { id: true },
      });

      if (!post) {
        throw new Error('POST_NOT_FOUND');
      }

      const comment = await tx.postComment.create({
        data: {
          userId,
          postId,
          content,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      });

      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      });

      return comment;
    });
  }

  /**
   * Finds a comment by ID with post owner information for authorization check.
   */
  public async findCommentById(commentId: string, includeDeleted = false) {
    return prisma.postComment.findFirst({
      where: {
        id: commentId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            avatarUrl: true,
          },
        },
        post: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });
  }

  /**
   * Finds comments for a post using cursor-based pagination.
   */
  public async findCommentsWithCursor(
    postId: string,
    params: {
      cursor?: CursorPayload | null;
      limit: number;
      order?: 'asc' | 'desc';
    },
  ) {
    const limit = Math.max(1, Math.min(50, Number(params.limit) || 20));
    const orderDirection = params.order === 'asc' ? 'asc' : 'desc';

    const where: Prisma.PostCommentWhereInput = {
      postId,
      deletedAt: null,
    };

    if (params.cursor) {
      const cursorDate = new Date(params.cursor.createdAt);
      const cursorId = params.cursor.id;

      if (orderDirection === 'desc') {
        where.AND = [
          {
            OR: [
              { createdAt: { lt: cursorDate } },
              {
                createdAt: cursorDate,
                id: { lt: cursorId },
              },
            ],
          },
        ];
      } else {
        where.AND = [
          {
            OR: [
              { createdAt: { gt: cursorDate } },
              {
                createdAt: cursorDate,
                id: { gt: cursorId },
              },
            ],
          },
        ];
      }
    }

    return prisma.postComment.findMany({
      where,
      orderBy: [
        { createdAt: orderDirection },
        { id: orderDirection },
      ],
      take: limit + 1,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  /**
   * Soft deletes a comment and decrements post commentCount.
   */
  public async softDeleteComment(commentId: string, postId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.postComment.update({
        where: { id: commentId },
        data: {
          deletedAt: new Date(),
        },
      });

      const post = await tx.post.findUnique({
        where: { id: postId },
        select: { commentCount: true },
      });

      if (post) {
        await tx.post.update({
          where: { id: postId },
          data: {
            commentCount: Math.max(0, post.commentCount - 1),
          },
        });
      }
    });
  }

  /**
   * Bookmarks a post for a user.
   */
  public async addBookmark(userId: string, postId: string): Promise<{ isBookmarked: boolean }> {
    const post = await prisma.post.findFirst({
      where: { id: postId, deletedAt: null, status: { not: 'DELETED' } },
      select: { id: true },
    });

    if (!post) {
      throw new Error('POST_NOT_FOUND');
    }

    await prisma.postBookmark.upsert({
      where: {
        userId_postId: { userId, postId },
      },
      create: { userId, postId },
      update: {},
    });

    return { isBookmarked: true };
  }

  /**
   * Removes bookmark from a post for a user.
   */
  public async removeBookmark(userId: string, postId: string): Promise<{ isBookmarked: boolean }> {
    const post = await prisma.post.findFirst({
      where: { id: postId, deletedAt: null, status: { not: 'DELETED' } },
      select: { id: true },
    });

    if (!post) {
      throw new Error('POST_NOT_FOUND');
    }

    await prisma.postBookmark.deleteMany({
      where: { userId, postId },
    });

    return { isBookmarked: false };
  }

  /**
   * Finds bookmarked posts of a user using cursor pagination on bookmarks.
   */
  public async findBookmarkedPostsWithCursor(
    userId: string,
    params: {
      cursor?: CursorPayload | null;
      limit: number;
    },
  ) {
    const limit = Math.max(1, Math.min(50, Number(params.limit) || 20));
    const where: Prisma.PostBookmarkWhereInput = {
      userId,
      post: {
        deletedAt: null,
        status: 'PUBLISHED',
      },
    };

    if (params.cursor) {
      const cursorDate = new Date(params.cursor.createdAt);
      const cursorId = params.cursor.id;

      where.AND = [
        {
          OR: [
            { createdAt: { lt: cursorDate } },
            {
              createdAt: cursorDate,
              id: { lt: cursorId },
            },
          ],
        },
      ];
    }

    return prisma.postBookmark.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit + 1,
      include: {
        post: {
          include: this.defaultPostInclude,
        },
      },
    });
  }

  /**
   * Atomically increments shareCount for a post.
   */
  public async incrementShareCount(postId: string): Promise<{ shareCount: number }> {
    return prisma.$transaction(async (tx) => {
      const post = await tx.post.findFirst({
        where: { id: postId, deletedAt: null, status: { not: 'DELETED' } },
        select: { id: true },
      });

      if (!post) {
        throw new Error('POST_NOT_FOUND');
      }

      const updated = await tx.post.update({
        where: { id: postId },
        data: { shareCount: { increment: 1 } },
        select: { shareCount: true },
      });

      return { shareCount: updated.shareCount };
    });
  }

  /**
   * Creates or updates a post report.
   */
  public async createReport(
    userId: string,
    postId: string,
    data: import('./dto/feed-report.dto').CreateReportDto,
  ) {
    const post = await prisma.post.findFirst({
      where: { id: postId, deletedAt: null, status: { not: 'DELETED' } },
      select: { id: true },
    });

    if (!post) {
      throw new Error('POST_NOT_FOUND');
    }

    return prisma.postReport.upsert({
      where: {
        userId_postId: { userId, postId },
      },
      create: {
        userId,
        postId,
        reason: data.reason,
        description: data.description || null,
      },
      update: {
        reason: data.reason,
        description: data.description || null,
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });
  }
}

export const feedsRepository = new FeedsRepository();


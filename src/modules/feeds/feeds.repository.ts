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
}

export const feedsRepository = new FeedsRepository();

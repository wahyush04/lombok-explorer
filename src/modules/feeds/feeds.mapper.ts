import {
  FeedAuthorResponse,
  FeedImageResponse,
  FeedLocationResponse,
  FeedPostResponse,
  FeedStatsResponse,
  FeedViewerResponse,
} from './feeds.types';

export interface PrismaPostWithRelations {
  id: string;
  userId: string;
  title: string;
  description: string;
  destinationId: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'DELETED';
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  user: {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  };
  destination?: {
    id: string;
    name: string;
    slug: string;
    latitude?: number;
    longitude?: number;
    address?: string | null;
  } | null;
  location?: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    address?: string | null;
    destination?: {
      id: string;
      name: string;
      slug: string;
    } | null;
  } | null;
  media?: Array<{
    id: string;
    url: string;
    imageUrl?: string | null;
    publicId?: string | null;
    width?: number | null;
    height?: number | null;
    format?: string | null;
    type: string;
    sortOrder?: number;
    orderIndex?: number;
    caption?: string | null;
  }>;
}

export class FeedsMapper {
  public static toAuthor(user: PrismaPostWithRelations['user']): FeedAuthorResponse {
    return {
      id: user.id,
      name: user.name,
      username: user.username,
      avatarUrl: user.avatarUrl || null,
    };
  }

  public static toLocation(post: PrismaPostWithRelations): FeedLocationResponse | null {
    if (post.location) {
      return {
        id: post.location.id,
        name: post.location.name,
        latitude: post.location.latitude,
        longitude: post.location.longitude,
        address: post.location.address || null,
        destinationId: post.destinationId || (post.destination ? post.destination.id : null),
        destination: post.destination
          ? {
              id: post.destination.id,
              name: post.destination.name,
              slug: post.destination.slug,
            }
          : post.location.destination
            ? {
                id: post.location.destination.id,
                name: post.location.destination.name,
                slug: post.location.destination.slug,
              }
            : null,
      };
    }

    if (post.destination) {
      return {
        name: post.destination.name,
        latitude: post.destination.latitude ?? post.latitude ?? 0,
        longitude: post.destination.longitude ?? post.longitude ?? 0,
        address: post.destination.address || null,
        destinationId: post.destination.id,
        destination: {
          id: post.destination.id,
          name: post.destination.name,
          slug: post.destination.slug,
        },
      };
    }

    if (post.locationName) {
      return {
        name: post.locationName,
        latitude: post.latitude ?? 0,
        longitude: post.longitude ?? 0,
        destinationId: post.destinationId || null,
        destination: null,
      };
    }

    return null;
  }

  public static toImages(mediaList?: PrismaPostWithRelations['media']): FeedImageResponse[] {
    if (!mediaList || mediaList.length === 0) {
      return [];
    }

    return [...mediaList]
      .sort((a, b) => (a.orderIndex ?? a.sortOrder ?? 0) - (b.orderIndex ?? b.sortOrder ?? 0))
      .map((item, idx) => {
        const orderIndex = item.orderIndex ?? item.sortOrder ?? idx;
        const imageUrl = item.imageUrl || item.url;
        return {
          id: item.id,
          imageUrl,
          url: item.url || imageUrl,
          publicId: item.publicId || null,
          width: item.width ?? null,
          height: item.height ?? null,
          format: item.format ?? null,
          orderIndex,
          sortOrder: orderIndex,
          caption: item.caption || null,
          type: item.type || 'IMAGE',
        };
      });
  }

  public static toMedia(mediaList?: PrismaPostWithRelations['media']): FeedImageResponse[] {
    return this.toImages(mediaList);
  }

  public static toStats(post: PrismaPostWithRelations): FeedStatsResponse {
    return {
      likeCount: post.likeCount ?? 0,
      commentCount: post.commentCount ?? 0,
      shareCount: post.shareCount ?? 0,
    };
  }

  public static toPostResponse(
    post: PrismaPostWithRelations,
    viewer?: FeedViewerResponse,
  ): FeedPostResponse {
    const images = this.toImages(post.media);
    const author = this.toAuthor(post.user);
    const isLiked = Boolean(viewer?.isLiked);
    const isBookmarked = Boolean(viewer?.isBookmarked);

    return {
      id: post.id,
      title: post.title,
      description: post.description,
      location: this.toLocation(post),
      author,
      user: author,
      images,
      media: images,
      likeCount: post.likeCount ?? 0,
      commentCount: post.commentCount ?? 0,
      shareCount: post.shareCount ?? 0,
      stats: this.toStats(post),
      isLiked,
      isBookmarked,
      viewer: viewer || {
        isLiked,
        isBookmarked,
      },
      status: post.status,
      createdAt:
        post.createdAt instanceof Date ? post.createdAt.toISOString() : String(post.createdAt),
      updatedAt:
        post.updatedAt instanceof Date ? post.updatedAt.toISOString() : String(post.updatedAt),
    };
  }

  public static toCommentResponse(
    comment: PrismaCommentWithUser,
  ): import('./feeds.types').FeedCommentResponse {
    return {
      id: comment.id,
      postId: comment.postId,
      user: this.toAuthor(comment.user),
      content: comment.content,
      createdAt:
        comment.createdAt instanceof Date
          ? comment.createdAt.toISOString()
          : String(comment.createdAt),
      updatedAt:
        comment.updatedAt instanceof Date
          ? comment.updatedAt.toISOString()
          : String(comment.updatedAt),
    };
  }
}

export interface PrismaCommentWithUser {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  user: {
    id: string;
    name: string;
    username: string;
    avatarUrl?: string | null;
  };
}

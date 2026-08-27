import {
  FeedAuthorResponse,
  FeedLocationResponse,
  FeedMediaResponse,
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
    type: string;
    sortOrder: number;
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
        destination: null,
      };
    }

    return null;
  }

  public static toMedia(mediaList?: PrismaPostWithRelations['media']): FeedMediaResponse[] {
    if (!mediaList || mediaList.length === 0) {
      return [];
    }

    return [...mediaList]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: item.id,
        url: item.url,
        type: item.type,
        sortOrder: item.sortOrder,
        caption: item.caption || null,
      }));
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
    return {
      id: post.id,
      author: this.toAuthor(post.user),
      title: post.title,
      description: post.description,
      location: this.toLocation(post),
      media: this.toMedia(post.media),
      stats: this.toStats(post),
      viewer: viewer || {
        isLiked: false,
        isBookmarked: false,
      },
      status: post.status,
      createdAt: post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt,
      updatedAt: post.updatedAt instanceof Date ? post.updatedAt.toISOString() : post.updatedAt,
    };
  }

  public static toCommentResponse(comment: PrismaCommentWithUser): import('./feeds.types').FeedCommentResponse {
    return {
      id: comment.id,
      postId: comment.postId,
      user: this.toAuthor(comment.user),
      content: comment.content,
      createdAt: comment.createdAt instanceof Date ? comment.createdAt.toISOString() : comment.createdAt,
      updatedAt: comment.updatedAt instanceof Date ? comment.updatedAt.toISOString() : comment.updatedAt,
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


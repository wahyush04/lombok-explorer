export interface CursorPayload {
  createdAt: string; // ISO 8601 string
  id: string;        // UUID
}

export interface CursorPaginationMeta {
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface CursorPaginatedData<T> {
  items: T[];
  pagination: CursorPaginationMeta;
}

export interface FeedAuthorResponse {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export interface FeedLocationResponse {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  destination?: {
    id: string;
    name: string;
    slug?: string;
  } | null;
}

export interface FeedMediaResponse {
  id: string;
  url: string;
  type: string;
  sortOrder: number;
  caption?: string | null;
}

export interface FeedStatsResponse {
  likeCount: number;
  commentCount: number;
  shareCount: number;
}

export interface FeedViewerResponse {
  isLiked: boolean;
  isBookmarked: boolean;
}

export interface FeedPostResponse {
  id: string;
  author: FeedAuthorResponse;
  title: string;
  description: string;
  location: FeedLocationResponse | null;
  media: FeedMediaResponse[];
  stats: FeedStatsResponse;
  viewer: FeedViewerResponse;
  status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'DELETED';
  createdAt: string;
  updatedAt: string;
}

export interface LikePostResponse {
  isLiked: boolean;
  likeCount: number;
}

export interface FeedCommentResponse {
  id: string;
  postId: string;
  user: FeedAuthorResponse;
  content: string;
  createdAt: string;
  updatedAt: string;
}


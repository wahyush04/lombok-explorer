import { z } from 'zod';
import { DestinationDto } from '../../destinations/dto/destination.dto';
import { AccommodationDto } from '../../accommodations/dto/accommodation.dto';
import { RestaurantDto } from '../../restaurants/dto/restaurant.dto';

export const FavoriteTypeEnum = z.enum(['DESTINATION', 'ACCOMMODATION', 'RESTAURANT']);
export type FavoriteType = z.infer<typeof FavoriteTypeEnum>;

export const FavoriteParamSchema = z.object({
  destinationId: z.string().min(1, 'Destination ID or slug is required'),
});

export const FavoriteTargetParamSchema = z.object({
  id: z.string().min(1, 'ID or slug is required'),
});

export const FavoriteQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  type: z.enum(['ALL', 'DESTINATION', 'ACCOMMODATION', 'RESTAURANT']).optional(),
});

export type FavoriteQuery = z.infer<typeof FavoriteQuerySchema>;

export interface FavoriteDto {
  id: string;
  userId: string;
  destinationId: string;
  createdAt: Date;
  destination: DestinationDto;
}

export interface NormalizedFavoriteItem {
  id: string;
  name: string;
  slug: string;
  type: FavoriteType;
  rating: number;
  reviewCount?: number;
  coverImageUrl: string;
  images: string[];
  region: string;
  address?: string | null;
  price?: number;
  priceFormatted?: string;
  isFavorite: boolean;
}

export interface UnifiedFavoriteItemDto {
  id: string;
  userId: string;
  type: FavoriteType;
  createdAt: Date;
  item: NormalizedFavoriteItem;
  destination?: DestinationDto;
  accommodation?: AccommodationDto;
  restaurant?: RestaurantDto;
}

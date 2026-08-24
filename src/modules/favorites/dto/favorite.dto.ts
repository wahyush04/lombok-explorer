import { z } from 'zod';
import { DestinationDto } from '../../destinations/dto/destination.dto';

export const FavoriteParamSchema = z.object({
  destinationId: z.string().min(1, 'Destination ID or slug is required'),
});

export const FavoriteQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type FavoriteQuery = z.infer<typeof FavoriteQuerySchema>;

export interface FavoriteDto {
  id: string;
  userId: string;
  destinationId: string;
  createdAt: Date;
  destination: DestinationDto;
}

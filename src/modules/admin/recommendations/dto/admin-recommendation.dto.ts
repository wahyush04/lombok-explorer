import { z } from 'zod';
import { TravelStyle, BudgetLevel } from '@prisma/client';

export const CreateAdminRecommendationSchema = z.object({
  title: z.string().trim().min(3, 'Title minimal 3 karakter'),
  subtitle: z.string().trim().min(3, 'Subtitle minimal 3 karakter').default('Rekomendasi Wisata Pilihan'),
  bannerUrl: z.string().url('Banner image URL is required'),
  bannerPublicId: z.string().optional().nullable(),
  travelStyle: z.nativeEnum(TravelStyle).default(TravelStyle.BEACH_RELAXATION),
  budgetLevel: z.nativeEnum(BudgetLevel).default(BudgetLevel.MID_RANGE),
  recommendedDays: z.coerce.number().int().min(1).default(3),
  estimatedBudget: z.coerce.number().min(0).default(500000),
  isActive: z.boolean().default(true),
  destinationIds: z.array(z.string()).default([]),
});

export const UpdateAdminRecommendationSchema = CreateAdminRecommendationSchema.partial();

export type CreateAdminRecommendationDto = z.infer<typeof CreateAdminRecommendationSchema>;
export type UpdateAdminRecommendationDto = z.infer<typeof UpdateAdminRecommendationSchema>;

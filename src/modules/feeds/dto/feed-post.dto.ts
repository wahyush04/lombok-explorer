import { z } from 'zod';

export const PostLocationInputSchema = z.object({
  name: z.string({ required_error: 'Location name is required' }).min(1, 'Location name cannot be empty').max(150),
  latitude: z.number({ required_error: 'Latitude is required' }).min(-90).max(90),
  longitude: z.number({ required_error: 'Longitude is required' }).min(-180).max(180),
  address: z.string().max(300).optional(),
  destinationId: z.string().optional(),
});

export const PostImageInputSchema = z
  .object({
    publicId: z.string().min(1, 'Image publicId cannot be empty').optional(),
    secureUrl: z.string().url('secureUrl must be a valid URL').optional(),
    url: z.string().url('url must be a valid URL').optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    format: z.string().optional(),
    orderIndex: z.number().int().min(0).default(0),
    sortOrder: z.number().int().min(0).optional(),
    caption: z.string().max(500).optional(),
    type: z.string().default('IMAGE'),
  })
  .refine((data) => Boolean(data.secureUrl || data.url), {
    message: 'Either secureUrl or url must be provided',
    path: ['secureUrl'],
  });

export const CreatePostDtoSchema = z
  .object({
    title: z
      .string({ required_error: 'Title is required' })
      .min(2, 'Title must be at least 2 characters')
      .max(150, 'Title must not exceed 150 characters'),
    description: z
      .string({ required_error: 'Description is required' })
      .min(2, 'Description must be at least 2 characters')
      .max(5000, 'Description must not exceed 5000 characters'),
    destinationId: z.string().optional(),
    location: PostLocationInputSchema.optional(),
    images: z.array(PostImageInputSchema).max(10, 'Maximum 10 images allowed per post').optional(),
    media: z.array(PostImageInputSchema).max(10, 'Maximum 10 media items allowed per post').optional(),
  })
  .refine(
    (data) => {
      // Must provide at least one destinationId or custom location (name, latitude, longitude)
      const hasDest = Boolean(data.destinationId || data.location?.destinationId);
      const hasLoc = Boolean(
        data.location &&
          data.location.name &&
          typeof data.location.latitude === 'number' &&
          typeof data.location.longitude === 'number',
      );
      return hasDest || hasLoc;
    },
    {
      message: 'Either destinationId or custom location (name, latitude, longitude) must be provided',
      path: ['location'],
    },
  );

export const UpdatePostDtoSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(150, 'Title must not exceed 150 characters').optional(),
  description: z.string().min(2, 'Description must be at least 2 characters').max(5000, 'Description must not exceed 5000 characters').optional(),
  destinationId: z.string().nullable().optional(),
  location: PostLocationInputSchema.nullable().optional(),
  images: z.array(PostImageInputSchema).max(10, 'Maximum 10 images allowed per post').optional(),
  media: z.array(PostImageInputSchema).max(10, 'Maximum 10 media items allowed per post').optional(),
});

export const FeedQueryDtoSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(50, 'Limit cannot exceed 50').default(20),
  destinationId: z.string().optional(),
  userId: z.string().optional(),
});

export const SearchDestinationQuerySchema = z.object({
  q: z.string().optional().default(''),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export type PostLocationInput = z.infer<typeof PostLocationInputSchema>;
export type PostImageInput = z.infer<typeof PostImageInputSchema>;
export type PostMediaInput = PostImageInput;
export type CreatePostDto = z.infer<typeof CreatePostDtoSchema>;
export type UpdatePostDto = z.infer<typeof UpdatePostDtoSchema>;
export type FeedQueryDto = z.infer<typeof FeedQueryDtoSchema>;
export type SearchDestinationQueryDto = z.infer<typeof SearchDestinationQuerySchema>;

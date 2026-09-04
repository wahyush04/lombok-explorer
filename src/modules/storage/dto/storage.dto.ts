import { z } from 'zod';

export const MediaUploadTypeEnum = z.enum([
  'DESTINATION',
  'ITINERARY',
  'ACTIVITY',
  'PROFILE',
  'CATEGORY',
  'FEED',
  'GENERAL',
]);
export type MediaUploadType = z.infer<typeof MediaUploadTypeEnum>;

export const ImageVariantEnum = z.enum(['thumbnail', 'card', 'cover', 'original']);
export type ImageVariant = z.infer<typeof ImageVariantEnum>;

export interface StoredMediaDto {
  url: string;
  secureUrl: string;
  publicId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  format?: string;
  provider: string;
  variants?: {
    thumbnail: string;
    card: string;
    cover: string;
  };
}

// Backward compatibility alias
export type StoredFileDto = StoredMediaDto;

export interface UploadMediaOptions {
  folder?: string;
  type?: MediaUploadType;
  entityId?: string;
  tags?: string[];
  transformation?: {
    width?: number;
    height?: number;
    crop?: string;
  };
}

export const UploadImageQuerySchema = z.object({
  type: MediaUploadTypeEnum.optional().default('GENERAL'),
  entityId: z.string().trim().optional(),
  folder: z.string().trim().optional(),
});
export type UploadImageQuery = z.infer<typeof UploadImageQuerySchema>;

export const DeleteMediaDtoSchema = z
  .object({
    publicId: z.string().trim().optional(),
    fileUrl: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.publicId || data.fileUrl), {
    message: 'Either "publicId" or "fileUrl" must be provided for deletion',
  });
export type DeleteMediaDto = z.infer<typeof DeleteMediaDtoSchema>;

// Backward compatibility alias
export const DeleteFileDtoSchema = DeleteMediaDtoSchema;
export type DeleteFileDto = DeleteMediaDto;

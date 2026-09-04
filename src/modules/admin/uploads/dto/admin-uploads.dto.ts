import { z } from 'zod';

export const AdminUploadResourceTypeEnum = z.enum([
  'DESTINATION',
  'DESTINATION_IMAGE',
  'RESTAURANT',
  'ACCOMMODATION',
  'ITINERARY_TEMPLATE',
  'CATEGORY',
  'USER',
  'USER_AVATAR',
  'REVIEW',
  'FEED',
]);
export type AdminUploadResourceType = z.infer<typeof AdminUploadResourceTypeEnum>;

export const AdminUploadSignatureRequestSchema = z.object({
  resourceType: AdminUploadResourceTypeEnum,
  resourceId: z.string().trim().optional(),
});
export type AdminUploadSignatureRequest = z.infer<typeof AdminUploadSignatureRequestSchema>;

export const CloudinaryAssetInputSchema = z.object({
  publicId: z.string().trim().min(1, 'publicId is required'),
  secureUrl: z.string().trim().url('secureUrl must be a valid URL'),
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
  format: z.string().trim().optional(),
  resourceType: z.string().trim().optional().default('image'),
  orderIndex: z.coerce.number().int().min(0).optional(),
  caption: z.string().trim().max(255).optional().nullable(),
  altText: z.string().trim().max(255).optional().nullable(),
  isPrimary: z.boolean().optional(),
});
export type CloudinaryAssetInput = z.infer<typeof CloudinaryAssetInputSchema>;

export interface AdminSignedUploadParamsDto {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  uploadUrl: string;
  uploadSessionId: string;
  allowedFormats: string[];
  maxFileSize: number;
  resourceType: AdminUploadResourceType;
  resourceId?: string;
}

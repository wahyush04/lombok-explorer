import { z } from 'zod';

export const SignedUploadFolderTypeEnum = z.enum([
  'feeds',
  'users',
  'destinations',
  'itineraries',
  'reviews',
  'general',
]);
export type SignedUploadFolderType = z.infer<typeof SignedUploadFolderTypeEnum>;

export const GenerateSignatureRequestSchema = z.object({
  folder: z.string().optional().default('feeds'),
});
export type GenerateSignatureRequest = z.infer<typeof GenerateSignatureRequestSchema>;

export interface SignedUploadParamsDto {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  uploadUrl: string;
}

export interface CloudinaryAssetValidationResult {
  isValid: boolean;
  publicId: string;
  secureUrl?: string;
  error?: string;
}

export interface CloudinaryResourceDetail {
  publicId: string;
  format: string;
  version: number;
  resourceType: string;
  type: string;
  createdAt: string;
  bytes: number;
  width: number;
  height: number;
  url: string;
  secureUrl: string;
}

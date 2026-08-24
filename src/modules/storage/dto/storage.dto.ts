import { z } from 'zod';

export interface StoredFileDto {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  path: string;
  provider: string;
}

export const DeleteFileDtoSchema = z.object({
  fileUrl: z.string().trim().min(1, 'File URL or filename is required'),
});

export type DeleteFileDto = z.infer<typeof DeleteFileDtoSchema>;

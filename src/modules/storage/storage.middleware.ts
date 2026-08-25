import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import { BadRequestError } from '../../common/errors/app-error';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      new BadRequestError(
        `Invalid file type '${file.mimetype}'. Only JPEG, PNG, WEBP, GIF, and SVG images are permitted.`,
        'INVALID_IMAGE_MIME_TYPE',
      ),
    );
  }
};

const storage = multer.memoryStorage();

export const imageUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});

export const uploadSingleImage = imageUpload.single('file');
export const uploadSingleImageField = (fieldName: string = 'image') =>
  imageUpload.single(fieldName);
export const uploadMultipleImages = imageUpload.array('files', 10);

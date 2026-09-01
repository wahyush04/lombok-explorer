import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { v2 as cloudinary } from 'cloudinary';
import {
  CloudinaryStorageProvider,
  cloudinaryStorageProvider,
} from '../src/modules/storage/providers/cloudinary-storage.provider';
import { StorageService } from '../src/modules/storage/storage.service';
import { UploadFileInput } from '../src/modules/storage/providers/storage-provider.interface';
import { BadRequestError } from '../src/common/errors/app-error';

describe('CloudinaryStorageProvider & Media Service Suite', () => {
  let provider: CloudinaryStorageProvider;
  let storage: StorageService;

  const testFile: UploadFileInput = {
    buffer: Buffer.from('test-image-binary-data'),
    originalname: 'tanjung_aan_beach.jpg',
    mimetype: 'image/jpeg',
    size: 24,
  };

  beforeEach(() => {
    provider = new CloudinaryStorageProvider();
    storage = new StorageService(provider);
  });

  describe('1. Folder Resolution Architecture', () => {
    it('should resolve folder path correctly for all entity types', () => {
      // Access private method through reflection / instance
      const resolveFolder = (provider as any).resolveFolder.bind(provider);

      expect(resolveFolder({ type: 'DESTINATION', entityId: 'dest-123' })).toBe(
        'lombok-explorer/destinations/dest-123',
      );
      expect(resolveFolder({ type: 'ITINERARY', entityId: 'itin-456' })).toBe(
        'lombok-explorer/itineraries/itin-456',
      );
      expect(resolveFolder({ type: 'ACTIVITY', entityId: 'act-789' })).toBe(
        'lombok-explorer/activities/act-789',
      );
      expect(resolveFolder({ type: 'PROFILE', entityId: 'user-001' })).toBe(
        'lombok-explorer/users/user-001',
      );
      expect(resolveFolder({ type: 'CATEGORY', entityId: 'cat-beach' })).toBe(
        'lombok-explorer/categories/cat-beach',
      );
      expect(resolveFolder({ type: 'FEED', entityId: 'post-999' })).toBe(
        'lombok-explorer/feeds/post-999',
      );
      expect(resolveFolder({ folder: 'custom-promo' })).toBe('lombok-explorer/custom-promo');
      expect(resolveFolder('custom-subfolder')).toBe('lombok-explorer/custom-subfolder');
      expect(resolveFolder({ type: 'GENERAL' })).toBe('lombok-explorer/general');
      expect(resolveFolder()).toBe('lombok-explorer/general');
    });
  });

  describe('2. Public ID Extraction', () => {
    it('should extract public ID from Cloudinary URL with version', () => {
      const url =
        'https://res.cloudinary.com/tzccdgab/image/upload/v1725180000/lombok-explorer/destinations/dest-123/merese.webp';
      const extracted = provider.extractPublicId(url);
      expect(extracted).toBe('lombok-explorer/destinations/dest-123/merese');
    });

    it('should extract public ID from Cloudinary URL without version', () => {
      const url =
        'https://res.cloudinary.com/tzccdgab/image/upload/lombok-explorer/users/avatar_user1.png';
      const extracted = provider.extractPublicId(url);
      expect(extracted).toBe('lombok-explorer/users/avatar_user1');
    });

    it('should return raw public ID if string is not a URL', () => {
      const rawId = 'lombok-explorer/categories/beaches';
      expect(provider.extractPublicId(rawId)).toBe(rawId);
    });

    it('should handle empty input gracefully', () => {
      expect(provider.extractPublicId('')).toBe('');
    });
  });

  describe('3. Transformation & Optimization Delivery Variants', () => {
    const publicId = 'lombok-explorer/destinations/gili-trawangan';

    it('should generate original URL with f_auto and q_auto transformations', () => {
      const url = provider.generateOptimizedUrl(publicId, 'original');
      expect(url).toContain(publicId);
      expect(url).toContain('f_auto');
      expect(url).toContain('q_auto');
    });

    it('should generate thumbnail variant (200x200 crop fill)', () => {
      const url = provider.generateOptimizedUrl(publicId, 'thumbnail');
      expect(url).toContain('w_200');
      expect(url).toContain('h_200');
      expect(url).toContain('c_fill');
      expect(url).toContain('f_auto');
      expect(url).toContain('q_auto');
    });

    it('should generate card variant (600x400 crop fill)', () => {
      const url = provider.generateOptimizedUrl(publicId, 'card');
      expect(url).toContain('w_600');
      expect(url).toContain('h_400');
      expect(url).toContain('c_fill');
    });

    it('should generate cover variant (1200x675 crop fill)', () => {
      const url = provider.generateOptimizedUrl(publicId, 'cover');
      expect(url).toContain('w_1200');
      expect(url).toContain('h_675');
      expect(url).toContain('c_fill');
    });
  });

  describe('4. Storage Service Operations & Validation', () => {
    it('should throw BadRequestError when uploading empty file buffer', async () => {
      await expect(
        storage.uploadImage({
          buffer: Buffer.alloc(0),
          originalname: 'empty.jpg',
          mimetype: 'image/jpeg',
        }),
      ).rejects.toThrowError(BadRequestError);
    });

    it('should throw BadRequestError when deleting with empty parameter', async () => {
      await expect(storage.deleteImage('')).rejects.toThrowError(BadRequestError);
    });

    it('should throw BadRequestError when replacing with empty file', async () => {
      await expect(
        storage.replaceImage('old-public-id', {
          buffer: Buffer.alloc(0),
          originalname: 'new.jpg',
          mimetype: 'image/jpeg',
        }),
      ).rejects.toThrowError(BadRequestError);
    });
  });

  describe('5. Upload, Delete & Replace Execution Flow (Mocked SDK)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should upload image buffer via upload_stream and return complete StoredMediaDto', async () => {
      vi.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((options: any, callback?: any) => {
        const stream = new (require('stream').PassThrough)();
        setTimeout(() => {
          if (callback) {
            callback(null, {
              public_id: `${options.folder}/mock_image_123`,
              secure_url: `https://res.cloudinary.com/tzccdgab/image/upload/${options.folder}/mock_image_123.jpg`,
              format: 'jpg',
              bytes: 1024,
              width: 1920,
              height: 1080,
            });
          }
        }, 10);
        return stream;
      });

      const result = await storage.uploadImage(testFile, {
        type: 'DESTINATION',
        entityId: 'dest-senaru',
      });

      expect(result).toBeDefined();
      expect(result.publicId).toBe('lombok-explorer/destinations/dest-senaru/mock_image_123');
      expect(result.provider).toBe('Cloudinary');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.format).toBe('jpg');
      expect(result.variants).toBeDefined();
      expect(result.variants?.thumbnail).toContain('w_200');
      expect(result.variants?.card).toContain('w_600');
      expect(result.variants?.cover).toContain('w_1200');
    });

    it('should delete image from Cloudinary by public ID', async () => {
      const destroySpy = vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });

      const success = await storage.deleteImage('lombok-explorer/destinations/dest-senaru/mock_image_123');
      expect(success).toBe(true);
      expect(destroySpy).toHaveBeenCalledWith(
        'lombok-explorer/destinations/dest-senaru/mock_image_123',
        expect.objectContaining({ invalidate: true }),
      );
    });

    it('should replace image by uploading new asset and deleting old asset', async () => {
      vi.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((options: any, callback?: any) => {
        const stream = new (require('stream').PassThrough)();
        setTimeout(() => {
          if (callback) {
            callback(null, {
              public_id: `${options.folder}/new_avatar_456`,
              secure_url: `https://res.cloudinary.com/tzccdgab/image/upload/${options.folder}/new_avatar_456.png`,
              format: 'png',
              bytes: 2048,
              width: 500,
              height: 500,
            });
          }
        }, 10);
        return stream;
      });

      const destroySpy = vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });

      const oldPublicId = 'lombok-explorer/users/user-1/old_avatar_123';
      const result = await storage.replaceImage(oldPublicId, testFile, {
        type: 'PROFILE',
        entityId: 'user-1',
      });

      expect(result.publicId).toBe('lombok-explorer/users/user-1/new_avatar_456');
      expect(destroySpy).toHaveBeenCalledWith(oldPublicId, expect.anything());
    });
  });
});

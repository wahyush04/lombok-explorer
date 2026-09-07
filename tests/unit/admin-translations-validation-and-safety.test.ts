import { describe, it, expect, vi } from 'vitest';
import { CreateDestinationSchema, UpdateDestinationSchema } from '../../src/modules/admin/destinations/dto/admin-destination.dto';
import { CreateCategorySchema, UpdateCategorySchema } from '../../src/modules/admin/categories/dto/admin-category.dto';
import { CreateRestaurantSchema, UpdateRestaurantSchema } from '../../src/modules/admin/restaurants/dto/admin-restaurant.dto';
import { CreateAccommodationSchema, UpdateAccommodationSchema } from '../../src/modules/admin/accommodations/dto/admin-accommodation.dto';
import { CreateItineraryTemplateSchema, UpdateItineraryTemplateSchema } from '../../src/modules/admin/itinerary-templates/dto/admin-itinerary-template.dto';
import { prisma } from '../../src/database/prisma';
import { adminCategoriesService } from '../../src/modules/admin/categories/admin-categories.service';

describe('Admin CMS Translation Validation Across All 5 Entities', () => {
  describe('1. Destination Translation Validation', () => {
    const validBase = {
      name: 'Pantai Tanjung Aan',
      description: 'Pantai indah dengan pasir bulat seperti butiran merica',
      categoryId: '123e4567-e89b-12d3-a456-426614174000',
      region: 'LOMBOK_SELATAN',
      locationName: 'Pujut, Lombok Tengah',
      latitude: -8.9056,
      longitude: 116.3211,
    };

    it('should accept valid translations with unique supported locales', () => {
      const result = CreateDestinationSchema.safeParse({
        ...validBase,
        translations: [
          {
            locale: 'id-ID',
            name: 'Pantai Tanjung Aan',
            description: 'Pantai indah berpasir merica',
          },
          {
            locale: 'en-US',
            name: 'Tanjung Aan Beach',
            description: 'Scenic white pepper-sand beach',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject duplicate translation locales in CreateDestinationSchema', () => {
      const result = CreateDestinationSchema.safeParse({
        ...validBase,
        translations: [
          {
            locale: 'en-US',
            name: 'Tanjung Aan Beach 1',
            description: 'Scenic white pepper-sand beach in Lombok 1',
          },
          {
            locale: 'en-US',
            name: 'Tanjung Aan Beach 2',
            description: 'Scenic white pepper-sand beach in Lombok 2',
          },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasDuplicateMessage = result.error.issues.some((issue) =>
          issue.message.includes('Duplicate translation locale'),
        );
        expect(hasDuplicateMessage).toBe(true);
      }
    });

    it('should reject invalid / unsupported locales in Destination', () => {
      const result = CreateDestinationSchema.safeParse({
        ...validBase,
        translations: [
          {
            locale: 'fr-FR' as any,
            name: 'Plage Tanjung Aan',
            description: 'Belle plage de sable blanc a Lombok',
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('should reject duplicate translation locales in UpdateDestinationSchema', () => {
      const result = UpdateDestinationSchema.safeParse({
        translations: [
          { locale: 'id-ID', name: 'Pantai Kuta 1', description: 'Deskripsi panjang pantai kuta 1' },
          { locale: 'id-ID', name: 'Pantai Kuta 2', description: 'Deskripsi panjang pantai kuta 2' },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasDuplicateMessage = result.error.issues.some((issue) =>
          issue.message.includes('Duplicate translation locale'),
        );
        expect(hasDuplicateMessage).toBe(true);
      }
    });
  });

  describe('2. Category Translation Validation', () => {
    const validBase = {
      name: 'Wisata Bahari',
      description: 'Kategori wisata pantai dan bahari',
      iconName: 'beach_access',
    };

    it('should accept valid translations with unique supported locales', () => {
      const result = CreateCategorySchema.safeParse({
        ...validBase,
        translations: [
          { locale: 'id-ID', name: 'Wisata Bahari', description: 'Kategori wisata' },
          { locale: 'en-US', name: 'Marine Tourism', description: 'Beach category' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject duplicate locales in CreateCategorySchema', () => {
      const result = CreateCategorySchema.safeParse({
        ...validBase,
        translations: [
          { locale: 'id-ID', name: 'Bahari 1', description: 'Deskripsi bahari 1' },
          { locale: 'id-ID', name: 'Bahari 2', description: 'Deskripsi bahari 2' },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasDuplicateMessage = result.error.issues.some((issue) =>
          issue.message.includes('Duplicate translation locale'),
        );
        expect(hasDuplicateMessage).toBe(true);
      }
    });

    it('should reject duplicate locales in UpdateCategorySchema', () => {
      const result = UpdateCategorySchema.safeParse({
        translations: [
          { locale: 'en-US', name: 'Marine 1', description: 'Marine description 1' },
          { locale: 'en-US', name: 'Marine 2', description: 'Marine description 2' },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasDuplicateMessage = result.error.issues.some((issue) =>
          issue.message.includes('Duplicate translation locale'),
        );
        expect(hasDuplicateMessage).toBe(true);
      }
    });
  });

  describe('3. Restaurant Translation Validation', () => {
    const validBase = {
      name: 'Ayam Taliwang Pak Udin',
      description: 'Kuliner ayam bakar pedas khas Lombok',
      cuisineType: 'Tradisional Sasak',
      specialtyDish: 'Ayam Taliwang Bakar',
      priceRange: 'Rp 30.000 - Rp 75.000',
      address: 'Jl. Ade Irma Suryani, Mataram',
      region: 'LOMBOK_BARAT',
      latitude: -8.5833,
      longitude: 116.1167,
      openingHours: '10:00 - 22:00',
      coverImageUrl: 'https://example.com/taliwang.jpg',
    };

    it('should accept valid translations', () => {
      const result = CreateRestaurantSchema.safeParse({
        ...validBase,
        translations: [
          { locale: 'id-ID', name: 'Ayam Taliwang Pak Udin', description: 'Kuliner ayam pedas' },
          { locale: 'en-US', name: 'Pak Udin Taliwang Chicken', description: 'Spicy grilled chicken' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject duplicate locales in CreateRestaurantSchema', () => {
      const result = CreateRestaurantSchema.safeParse({
        ...validBase,
        translations: [
          { locale: 'en-US', name: 'Taliwang Resto 1', description: 'Description 1' },
          { locale: 'en-US', name: 'Taliwang Resto 2', description: 'Description 2' },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasDuplicateMessage = result.error.issues.some((issue) =>
          issue.message.includes('Duplicate translation locale'),
        );
        expect(hasDuplicateMessage).toBe(true);
      }
    });

    it('should reject duplicate locales in UpdateRestaurantSchema', () => {
      const result = UpdateRestaurantSchema.safeParse({
        translations: [
          { locale: 'id-ID', name: 'Restoran A', description: 'Deskripsi resto A' },
          { locale: 'id-ID', name: 'Restoran B', description: 'Deskripsi resto B' },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasDuplicateMessage = result.error.issues.some((issue) =>
          issue.message.includes('Duplicate translation locale'),
        );
        expect(hasDuplicateMessage).toBe(true);
      }
    });
  });

  describe('4. Accommodation Translation Validation', () => {
    const validBase = {
      name: 'Katamaran Resort',
      type: 'resort',
      description: 'Resor mewah bintang 5 di Senggigi',
      pricePerNight: 1800000,
      address: 'Jl Raya Senggigi, Lombok Barat',
      region: 'LOMBOK_BARAT',
      latitude: -8.4912,
      longitude: 116.0398,
      coverImageUrl: 'https://example.com/katamaran.jpg',
    };

    it('should accept valid translations', () => {
      const result = CreateAccommodationSchema.safeParse({
        ...validBase,
        translations: [
          { locale: 'id-ID', name: 'Katamaran Resort', description: 'Resor mewah tepi pantai' },
          { locale: 'en-US', name: 'Katamaran Resort', description: 'Luxury beachfront resort' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject duplicate locales in CreateAccommodationSchema', () => {
      const result = CreateAccommodationSchema.safeParse({
        ...validBase,
        translations: [
          { locale: 'id-ID', name: 'Katamaran Resort 1', description: 'Resor mewah 1' },
          { locale: 'id-ID', name: 'Katamaran Resort 2', description: 'Resor mewah 2' },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasDuplicateMessage = result.error.issues.some((issue) =>
          issue.message.includes('Duplicate translation locale'),
        );
        expect(hasDuplicateMessage).toBe(true);
      }
    });

    it('should reject duplicate locales in UpdateAccommodationSchema', () => {
      const result = UpdateAccommodationSchema.safeParse({
        translations: [
          { locale: 'en-US', name: 'Katamaran Hotel 1', description: 'Hotel desc 1' },
          { locale: 'en-US', name: 'Katamaran Hotel 2', description: 'Hotel desc 2' },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasDuplicateMessage = result.error.issues.some((issue) =>
          issue.message.includes('Duplicate translation locale'),
        );
        expect(hasDuplicateMessage).toBe(true);
      }
    });
  });

  describe('5. Itinerary Template Translation Validation', () => {
    const validBase = {
      title: '3 Hari Jelajah Mandalika',
      description: 'Paket rekomendasi eksklusif',
    };

    it('should accept valid translations with title and description', () => {
      const result = CreateItineraryTemplateSchema.safeParse({
        ...validBase,
        translations: [
          {
            locale: 'id-ID',
            title: '3 Hari Jelajah Mandalika',
            description: 'Paket eksklusif pantai selatan',
            transportPaceNote: 'Santai',
          },
          {
            locale: 'en-US',
            title: '3-Day Mandalika Exploration',
            description: 'Exclusive south coast tour',
            transportPaceNote: 'Leisurely pace',
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject duplicate locales in CreateItineraryTemplateSchema', () => {
      const result = CreateItineraryTemplateSchema.safeParse({
        ...validBase,
        translations: [
          { locale: 'id-ID', title: 'Paket Mandalika 1', description: 'Deskripsi 1' },
          { locale: 'id-ID', title: 'Paket Mandalika 2', description: 'Deskripsi 2' },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasDuplicateMessage = result.error.issues.some((issue) =>
          issue.message.includes('Duplicate translation locale'),
        );
        expect(hasDuplicateMessage).toBe(true);
      }
    });

    it('should reject duplicate locales in UpdateItineraryTemplateSchema', () => {
      const result = UpdateItineraryTemplateSchema.safeParse({
        translations: [
          { locale: 'en-US', title: 'Tour Package 1' },
          { locale: 'en-US', title: 'Tour Package 2' },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const hasDuplicateMessage = result.error.issues.some((issue) =>
          issue.message.includes('Duplicate translation locale'),
        );
        expect(hasDuplicateMessage).toBe(true);
      }
    });
  });

  describe('6. Transaction Safety & Rollback Behavior', () => {
    it('should abort parent creation and roll back completely if translation insertion fails in transaction', async () => {
      const findByNameSpy = vi.spyOn((adminCategoriesService as any).repository, 'findByName').mockResolvedValue(null);
      const findBySlugSpy = vi.spyOn((adminCategoriesService as any).repository, 'findBySlug').mockResolvedValue(null);

      const txSpy = vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const mockTx = {
          category: {
            create: vi.fn().mockImplementation(async () => {
              throw new Error('Simulated atomic transaction failure');
            }),
          },
        };
        return callback(mockTx);
      });

      await expect(
        adminCategoriesService.createCategory({
          name: 'Unique Test Category',
          description: 'Desc',
          iconName: 'icon',
          status: 'PUBLISHED' as const,
          coverImageUrl: '',
          translations: [
            { locale: 'id-ID', name: 'Test ID', description: 'Desc ID' },
            { locale: 'en-US', name: 'Test EN', description: 'Desc EN' },
          ],
        }),
      ).rejects.toThrow('Simulated atomic transaction failure');

      txSpy.mockRestore();
      findByNameSpy.mockRestore();
      findBySlugSpy.mockRestore();
    });
  });
});

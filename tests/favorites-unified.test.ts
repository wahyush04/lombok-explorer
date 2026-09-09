import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { favoritesService } from '../src/modules/favorites/favorites.service';
import { FavoritesService } from '../src/modules/favorites/favorites.service';
import { FavoritesRepository } from '../src/modules/favorites/favorites.repository';
import { DestinationsRepository } from '../src/modules/destinations/destinations.repository';
import { DestinationsService } from '../src/modules/destinations/destinations.service';
import { AccommodationsRepository, accommodationsRepository } from '../src/modules/accommodations/accommodations.repository';
import { AccommodationsService } from '../src/modules/accommodations/accommodations.service';
import { RestaurantsRepository, restaurantsRepository } from '../src/modules/restaurants/restaurants.repository';
import { RestaurantsService } from '../src/modules/restaurants/restaurants.service';
import { prisma } from '../src/database/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../src/config/config';

describe('Unified Favorites API & Accommodation/Restaurant Favorites', () => {
  let app: Application;
  const mockUserId = 'user-test-uuid-123';
  const mockToken = jwt.sign(
    { userId: mockUserId, email: 'test@lombokexplorer.com', role: 'USER' },
    config.jwt.accessSecret,
    { expiresIn: '1h' },
  );

  beforeEach(() => {
    app = createApp();
    vi.restoreAllMocks();
  });

  describe('1. Authentication Enforcement', () => {
    it('should reject unauthenticated request to GET /v1/favorites/all (401)', async () => {
      const res = await request(app).get('/v1/favorites/all');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject unauthenticated request to POST /v1/accommodations/hotel-abc/favorite (401)', async () => {
      const res = await request(app).post('/v1/accommodations/hotel-abc/favorite');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject unauthenticated request to DELETE /v1/accommodations/hotel-abc/favorite (401)', async () => {
      const res = await request(app).delete('/v1/accommodations/hotel-abc/favorite');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject unauthenticated request to GET /v1/accommodations/hotel-abc/favorite (401)', async () => {
      const res = await request(app).get('/v1/accommodations/hotel-abc/favorite');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject unauthenticated request to POST /v1/restaurants/resto-xyz/favorite (401)', async () => {
      const res = await request(app).post('/v1/restaurants/resto-xyz/favorite');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject unauthenticated request to DELETE /v1/restaurants/resto-xyz/favorite (401)', async () => {
      const res = await request(app).delete('/v1/restaurants/resto-xyz/favorite');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });

    it('should reject unauthenticated request to GET /v1/restaurants/resto-xyz/favorite (401)', async () => {
      const res = await request(app).get('/v1/restaurants/resto-xyz/favorite');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('TOKEN_MISSING');
    });
  });

  describe('2. Unified Favorites Service Logic', () => {
    it('should normalize destination, accommodation, and restaurant records in unified favorites', async () => {
      const mockFavRepo = {
        getUserUnifiedFavorites: vi.fn().mockResolvedValue({
          items: [
            {
              id: 'fav-1',
              userId: mockUserId,
              type: 'DESTINATION',
              createdAt: new Date('2026-09-08T10:00:00Z'),
              destination: {
                id: 'dest-1',
                slug: 'pantai-tanjung-aan',
                name: 'Pantai Tanjung Aan',
                description: 'Pantai indah',
                shortDescription: 'Pantai',
                region: 'LOMBOK_TENGAH',
                address: 'Sengkol, Lombok Tengah',
                rating: 4.8,
                reviewCount: 120,
                entranceFee: 10000,
                coverImageUrl: 'https://images.example.com/dest1.jpg',
                images: [],
                category: { id: 'cat-1', name: 'Pantai', slug: 'pantai' },
              },
            },
            {
              id: 'fav-2',
              userId: mockUserId,
              type: 'ACCOMMODATION',
              createdAt: new Date('2026-09-08T09:00:00Z'),
              accommodation: {
                id: 'acc-1',
                slug: 'pullman-mandalika',
                name: 'Pullman Mandalika',
                description: 'Resor mewah',
                type: 'resort',
                region: 'LOMBOK_TENGAH',
                address: 'Kuta Mandalika',
                rating: 4.9,
                reviewCount: 350,
                pricePerNight: 1850000,
                coverImageUrl: 'https://images.example.com/acc1.jpg',
                images: [],
                amenities: '["Pool", "WiFi"]',
                status: 'PUBLISHED',
                isFeatured: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
            {
              id: 'fav-3',
              userId: mockUserId,
              type: 'RESTAURANT',
              createdAt: new Date('2026-09-08T08:00:00Z'),
              restaurant: {
                id: 'rest-1',
                slug: 'ayam-taliwang-h-ipip',
                name: 'Ayam Taliwang H. Ipip',
                description: 'Kuliner lezat',
                cuisineType: 'Sasak',
                specialtyDish: 'Ayam Bakar',
                priceRange: 'Rp 35.000 - Rp 75.000',
                minPrice: 35000,
                maxPrice: 75000,
                region: 'MATARAM',
                address: 'Jl. Majapahit',
                rating: 4.7,
                reviewCount: 500,
                coverImageUrl: 'https://images.example.com/rest1.jpg',
                images: [],
                isHalalCertified: true,
                status: 'PUBLISHED',
                isFeatured: true,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          ],
          total: 3,
        }),
      } as unknown as FavoritesRepository;

      const destService = new DestinationsService({} as unknown as DestinationsRepository);
      const accService = new AccommodationsService({} as unknown as AccommodationsRepository);
      const restService = new RestaurantsService({} as unknown as RestaurantsRepository);

      const service = new FavoritesService(
        mockFavRepo,
        {} as unknown as DestinationsRepository,
        destService,
        {} as unknown as AccommodationsRepository,
        accService,
        {} as unknown as RestaurantsRepository,
        restService,
      );

      const result = await service.getUserUnifiedFavorites(mockUserId, { page: 1, limit: 10, type: 'ALL' });

      expect(result.data.length).toBe(3);
      expect(result.meta.total).toBe(3);

      // 1. Destination check
      expect(result.data[0].type).toBe('DESTINATION');
      expect(result.data[0].item.name).toBe('Pantai Tanjung Aan');
      expect(result.data[0].item.isFavorite).toBe(true);
      expect(result.data[0].item.priceFormatted).toBe('Rp 10.000');
      expect(result.data[0].destination).toBeDefined();

      // 2. Accommodation check
      expect(result.data[1].type).toBe('ACCOMMODATION');
      expect(result.data[1].item.name).toBe('Pullman Mandalika');
      expect(result.data[1].item.isFavorite).toBe(true);
      expect(result.data[1].item.priceFormatted).toBe('Rp 1.850.000/malam');
      expect(result.data[1].accommodation).toBeDefined();

      // 3. Restaurant check
      expect(result.data[2].type).toBe('RESTAURANT');
      expect(result.data[2].item.name).toBe('Ayam Taliwang H. Ipip');
      expect(result.data[2].item.isFavorite).toBe(true);
      expect(result.data[2].item.priceFormatted).toBe('Rp 35.000 - Rp 75.000');
      expect(result.data[2].restaurant).toBeDefined();
    });

    it('should toggle accommodation favorite on and off', async () => {
      const mockAcc = {
        id: 'acc-uuid-1',
        slug: 'villa-indah',
        name: 'Villa Indah',
        description: 'Villa indah di tepi bukit',
        type: 'villa',
        region: 'LOMBOK_BARAT',
        address: 'Senggigi',
        rating: 4.6,
        reviewCount: 80,
        pricePerNight: 950000,
        coverImageUrl: 'https://images.example.com/villa.jpg',
        images: [],
        amenities: '["Pool"]',
        status: 'PUBLISHED',
        isFeatured: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAccRepo = {
        findByIdOrSlug: vi.fn().mockResolvedValue(mockAcc),
      } as unknown as AccommodationsRepository;

      let isFavorited = false;
      const mockFavRepo = {
        findAccommodationFavorite: vi.fn().mockImplementation(() => {
          return isFavorited ? { id: 'fav-acc-1', userId: mockUserId, accommodationId: mockAcc.id } : null;
        }),
        addAccommodationFavorite: vi.fn().mockImplementation(() => {
          isFavorited = true;
          return { id: 'fav-acc-1', accommodation: mockAcc };
        }),
        removeAccommodationFavorite: vi.fn().mockImplementation(() => {
          isFavorited = false;
          return { id: 'fav-acc-1' };
        }),
      } as unknown as FavoritesRepository;

      const accService = new AccommodationsService(mockAccRepo);
      const service = new FavoritesService(
        mockFavRepo,
        {} as unknown as DestinationsRepository,
        {} as unknown as DestinationsService,
        mockAccRepo,
        accService,
        {} as unknown as RestaurantsRepository,
        {} as unknown as RestaurantsService,
      );

      // Toggle ON
      const resOn = await service.toggleAccommodationFavorite(mockUserId, 'villa-indah');
      expect(resOn.isFavorite).toBe(true);
      expect(resOn.accommodationId).toBe('acc-uuid-1');
      expect(resOn.message).toContain('added to favorites');

      // Toggle OFF
      const resOff = await service.toggleAccommodationFavorite(mockUserId, 'villa-indah');
      expect(resOff.isFavorite).toBe(false);
      expect(resOff.accommodationId).toBe('acc-uuid-1');
      expect(resOff.message).toContain('removed from favorites');
    });

    it('should toggle restaurant favorite on and off', async () => {
      const mockRest = {
        id: 'rest-uuid-1',
        slug: 'sate-rembiga-utama',
        name: 'Sate Rembiga Utama',
        description: 'Sate rembiga pedas gurih',
        cuisineType: 'Sasak',
        specialtyDish: 'Sate Sapi Rembiga',
        priceRange: 'Rp 25.000 - Rp 50.000',
        minPrice: 25000,
        maxPrice: 50000,
        region: 'MATARAM',
        address: 'Rembiga, Mataram',
        rating: 4.8,
        reviewCount: 400,
        coverImageUrl: 'https://images.example.com/sate.jpg',
        images: [],
        isHalalCertified: true,
        status: 'PUBLISHED',
        isFeatured: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockRestRepo = {
        findByIdOrSlug: vi.fn().mockResolvedValue(mockRest),
      } as unknown as RestaurantsRepository;

      let isFavorited = false;
      const mockFavRepo = {
        findRestaurantFavorite: vi.fn().mockImplementation(() => {
          return isFavorited ? { id: 'fav-rest-1', userId: mockUserId, restaurantId: mockRest.id } : null;
        }),
        addRestaurantFavorite: vi.fn().mockImplementation(() => {
          isFavorited = true;
          return { id: 'fav-rest-1', restaurant: mockRest };
        }),
        removeRestaurantFavorite: vi.fn().mockImplementation(() => {
          isFavorited = false;
          return { id: 'fav-rest-1' };
        }),
      } as unknown as FavoritesRepository;

      const restService = new RestaurantsService(mockRestRepo);
      const service = new FavoritesService(
        mockFavRepo,
        {} as unknown as DestinationsRepository,
        {} as unknown as DestinationsService,
        {} as unknown as AccommodationsRepository,
        {} as unknown as AccommodationsService,
        mockRestRepo,
        restService,
      );

      // Toggle ON
      const resOn = await service.toggleRestaurantFavorite(mockUserId, 'sate-rembiga-utama');
      expect(resOn.isFavorite).toBe(true);
      expect(resOn.restaurantId).toBe('rest-uuid-1');
      expect(resOn.message).toContain('added to favorites');

      // Toggle OFF
      const resOff = await service.toggleRestaurantFavorite(mockUserId, 'sate-rembiga-utama');
      expect(resOff.isFavorite).toBe(false);
      expect(resOff.restaurantId).toBe('rest-uuid-1');
      expect(resOff.message).toContain('removed from favorites');
    });
  });

  describe('3. Controller & HTTP Endpoint Integration with Mocked Service', () => {
    it('GET /v1/favorites/all should return 200 with unified list schema', async () => {
      vi.spyOn(favoritesService, 'getUserUnifiedFavorites').mockResolvedValue({
        data: [
          {
            id: 'fav-1',
            userId: mockUserId,
            type: 'ACCOMMODATION',
            createdAt: new Date(),
            item: {
              id: 'acc-1',
              name: 'Resort Senggigi',
              slug: 'resort-senggigi',
              type: 'ACCOMMODATION',
              rating: 4.8,
              coverImageUrl: 'https://example.com/cover.jpg',
              images: [],
              region: 'LOMBOK_BARAT',
              address: 'Senggigi',
              price: 1500000,
              priceFormatted: 'Rp 1.500.000/malam',
              isFavorite: true,
            },
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          currentPage: 1,
          totalCount: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const res = await request(app)
        .get('/v1/favorites/all')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].type).toBe('ACCOMMODATION');
      expect(res.body.data[0].item.name).toBe('Resort Senggigi');
    });

    it('POST /v1/accommodations/:id/favorite should toggle accommodation favorite', async () => {
      vi.spyOn(favoritesService, 'toggleAccommodationFavorite').mockResolvedValue({
        isFavorite: true,
        accommodationId: 'acc-uuid-999',
        accommodationName: 'Lombok Sunset Villa',
        accommodation: {} as any,
        message: 'Accommodation added to favorites successfully',
      });

      const res = await request(app)
        .post('/v1/accommodations/lombok-sunset-villa/favorite')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFavorite).toBe(true);
      expect(res.body.data.accommodationId).toBe('acc-uuid-999');
    });

    it('GET /v1/accommodations/:id/favorite should return status', async () => {
      vi.spyOn(favoritesService, 'getAccommodationFavoriteStatus').mockResolvedValue({
        isFavorite: true,
        accommodationId: 'acc-uuid-999',
        accommodationName: 'Lombok Sunset Villa',
      });

      const res = await request(app)
        .get('/v1/accommodations/lombok-sunset-villa/favorite')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFavorite).toBe(true);
    });

    it('POST /v1/restaurants/:id/favorite should toggle restaurant favorite', async () => {
      vi.spyOn(favoritesService, 'toggleRestaurantFavorite').mockResolvedValue({
        isFavorite: true,
        restaurantId: 'rest-uuid-888',
        restaurantName: 'Ayam Taliwang Ipip',
        restaurant: {} as any,
        message: 'Restaurant added to favorites successfully',
      });

      const res = await request(app)
        .post('/v1/restaurants/ayam-taliwang-ipip/favorite')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFavorite).toBe(true);
      expect(res.body.data.restaurantId).toBe('rest-uuid-888');
    });

    it('GET /v1/restaurants/:id/favorite should return status', async () => {
      vi.spyOn(favoritesService, 'getRestaurantFavoriteStatus').mockResolvedValue({
        isFavorite: false,
        restaurantId: 'rest-uuid-888',
        restaurantName: 'Ayam Taliwang Ipip',
      });

      const res = await request(app)
        .get('/v1/restaurants/ayam-taliwang-ipip/favorite')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFavorite).toBe(false);
    });

    it('GET /v1/favorites without type param should preserve backward compatibility (call getUserFavorites)', async () => {
      const spyDest = vi.spyOn(favoritesService, 'getUserFavorites').mockResolvedValue({
        data: [
          {
            id: 'dest-1',
            slug: 'pantai-kuta',
            name: 'Pantai Kuta',
            shortDescription: 'Pantai',
            description: 'Pantai',
            categoryId: 'cat-1',
            categoryName: 'Pantai',
            categorySlug: 'pantai',
            region: 'LOMBOK_TENGAH',
            locationName: 'Kuta',
            address: 'Kuta, Lombok',
            latitude: -8.89,
            longitude: 116.28,
            rating: 4.7,
            reviewCount: 50,
            entranceFee: 10000,
            currency: 'IDR',
            coverImageUrl: 'https://example.com/kuta.jpg',
            images: [],
            facilities: [],
            isFeatured: true,
            isFavorite: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          currentPage: 1,
          totalCount: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const res = await request(app)
        .get('/v1/favorites')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(spyDest).toHaveBeenCalled();
      expect(res.body.data[0].slug).toBe('pantai-kuta');
    });

    it('GET /v1/favorites?type=ACCOMMODATION should route to getUserUnifiedFavorites', async () => {
      const spyUnified = vi.spyOn(favoritesService, 'getUserUnifiedFavorites').mockResolvedValue({
        data: [],
        meta: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 1,
          currentPage: 1,
          totalCount: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });

      const res = await request(app)
        .get('/v1/favorites?type=ACCOMMODATION')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(res.status).toBe(200);
      expect(spyUnified).toHaveBeenCalled();
    });
  });

  describe('5. Repository Non-UUID Custom ID Support', () => {
    it('accommodationsRepository.findByIdOrSlug should query OR with id and slug for custom prefix IDs', async () => {
      const mockFindFirst = vi.spyOn(prisma.accommodation, 'findFirst').mockResolvedValue({
        id: 'acc_jeeva_beloam_camp',
        slug: 'jeeva-beloam-beach-camp',
        name: 'Jeeva Beloam Beach Camp',
      } as any);

      const result = await accommodationsRepository.findByIdOrSlug('acc_jeeva_beloam_camp');
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ id: 'acc_jeeva_beloam_camp' }, { slug: 'acc_jeeva_beloam_camp' }],
            deletedAt: null,
            status: 'PUBLISHED',
          },
        }),
      );
      expect(result?.id).toBe('acc_jeeva_beloam_camp');
    });

    it('restaurantsRepository.findByIdOrSlug should query OR with id and slug for custom prefix IDs', async () => {
      const mockFindFirst = vi.spyOn(prisma.restaurant, 'findFirst').mockResolvedValue({
        id: 'resto_ayam_taliwang_ipip',
        slug: 'ayam-taliwang-irama',
        name: 'Ayam Taliwang Irama',
      } as any);

      const result = await restaurantsRepository.findByIdOrSlug('resto_ayam_taliwang_ipip');
      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ id: 'resto_ayam_taliwang_ipip' }, { slug: 'resto_ayam_taliwang_ipip' }],
            deletedAt: null,
            status: 'PUBLISHED',
          },
        }),
      );
      expect(result?.id).toBe('resto_ayam_taliwang_ipip');
    });
  });
});

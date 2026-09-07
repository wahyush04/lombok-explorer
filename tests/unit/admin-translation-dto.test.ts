import { describe, it, expect } from 'vitest';
import { adminDestinationsService } from '../../src/modules/admin/destinations/admin-destinations.service';
import { adminCategoriesService } from '../../src/modules/admin/categories/admin-categories.service';
import { adminRestaurantsService } from '../../src/modules/admin/restaurants/admin-restaurants.service';
import { adminAccommodationsService } from '../../src/modules/admin/accommodations/admin-accommodations.service';
import { adminItineraryTemplatesService } from '../../src/modules/admin/itinerary-templates/admin-itinerary-templates.service';

describe('Admin CMS Translation DTO & Metadata Mapping', () => {
  it('should map Destination translations and compute availableLocales & missingLocales correctly', () => {
    const rawDestination: any = {
      id: 'dest-1',
      slug: 'pantai-kuta',
      name: 'Pantai Kuta (Canonical)',
      shortDescription: 'Pantai pasir merica',
      description: 'Deskripsi lengkap pantai kuta lombok',
      categoryId: 'cat-1',
      category: { name: 'Pantai', slug: 'pantai' },
      region: 'SOUTH_LOMBOK',
      locationName: 'Pujut, Lombok Tengah',
      address: 'Jl Kuta',
      latitude: -8.89,
      longitude: 116.28,
      rating: 4.8,
      reviewCount: 120,
      entranceFee: 10000,
      currency: 'IDR',
      openingHours: '06:00 - 18:00',
      estimatedDurationMinutes: 120,
      bestVisitingTime: 'Sore hari',
      difficulty: 'EASY',
      tags: '["pantai", "sunset"]',
      coverImageUrl: 'https://example.com/kuta.jpg',
      coverImagePublicId: 'kuta_cover',
      facilities: '["toilet", "parkir"]',
      tips: '["bawa kacamata hitam"]',
      status: 'PUBLISHED',
      isFeatured: true,
      translations: [
        {
          locale: 'id-ID',
          name: 'Pantai Kuta',
          shortDescription: 'Pantai indah berpasir merica',
          description: 'Deskripsi lengkap bahasa Indonesia',
          address: 'Jl Kuta, Lombok Tengah',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const dto = adminDestinationsService.mapToAdminDto(rawDestination);

    expect(dto.translations).toHaveLength(1);
    expect(dto.translations[0].locale).toBe('id-ID');
    expect(dto.availableLocales).toEqual(['id-ID']);
    expect(dto.missingLocales).toEqual(['en-US']);
  });

  it('should reflect missingLocales as empty when all supported locales are translated', () => {
    const rawCategory: any = {
      id: 'cat-1',
      name: 'Pantai',
      slug: 'pantai',
      description: 'Kategori wisata pantai',
      iconName: 'beach_access',
      coverImageUrl: 'https://example.com/cat.jpg',
      coverImagePublicId: null,
      status: 'PUBLISHED',
      destinationsCount: 5,
      translations: [
        {
          locale: 'id-ID',
          name: 'Pantai',
          description: 'Wisata pesisir pantai',
        },
        {
          locale: 'en-US',
          name: 'Beaches',
          description: 'Coastal beach destinations',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const dto = adminCategoriesService.mapToAdminDto(rawCategory);

    expect(dto.translations).toHaveLength(2);
    expect(dto.availableLocales).toContain('id-ID');
    expect(dto.availableLocales).toContain('en-US');
    expect(dto.missingLocales).toEqual([]);
  });

  it('should map Restaurant translations and compute locale availability', () => {
    const rawRestaurant: any = {
      id: 'rest-1',
      name: 'Ayam Taliwang Pak Udin',
      slug: 'ayam-taliwang-pak-udin',
      description: 'Restoran khas Lombok',
      cuisineType: 'Lombok Traditional',
      specialtyDish: 'Ayam Taliwang Pedas',
      priceRange: '$$',
      minPrice: 30000,
      maxPrice: 100000,
      rating: 4.9,
      reviewCount: 300,
      address: 'Cakranegara, Mataram',
      region: 'WEST_LOMBOK',
      latitude: -8.58,
      longitude: 116.12,
      openingHours: '10:00 - 22:00',
      coverImageUrl: 'https://example.com/taliwang.jpg',
      coverImagePublicId: null,
      images: '[]',
      isHalalCertified: true,
      status: 'PUBLISHED',
      isFeatured: true,
      translations: [
        {
          locale: 'id-ID',
          name: 'Ayam Taliwang Pak Udin',
          description: 'Ayam bakar bumbu pedas khas Taliwang',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const dto = adminRestaurantsService.mapToDto(rawRestaurant);

    expect(dto.translations).toHaveLength(1);
    expect(dto.availableLocales).toEqual(['id-ID']);
    expect(dto.missingLocales).toEqual(['en-US']);
  });

  it('should map Accommodation translations and compute locale availability', () => {
    const rawAccommodation: any = {
      id: 'acc-1',
      name: 'Novotel Lombok Resort',
      slug: 'novotel-lombok-resort',
      type: 'resort',
      description: 'Resor tepi pantai bintang 4',
      rating: 4.7,
      reviewCount: 450,
      pricePerNight: 1200000,
      currency: 'IDR',
      address: 'Pantai Putri Nyale, Kuta',
      region: 'SOUTH_LOMBOK',
      latitude: -8.9,
      longitude: 116.3,
      coverImageUrl: 'https://example.com/novotel.jpg',
      coverImagePublicId: null,
      images: '[]',
      facilities: '["kolam renang", "spa"]',
      amenities: '["kolam renang", "spa"]',
      contactPhone: '+623706153333',
      websiteUrl: 'https://all.accor.com',
      status: 'PUBLISHED',
      isFeatured: true,
      translations: [
        {
          locale: 'id-ID',
          name: 'Novotel Lombok Resort & Villas',
          description: 'Resor mewah tepi pantai khas Sasak',
        },
        {
          locale: 'en-US',
          name: 'Novotel Lombok Resort & Villas',
          description: 'Luxury beachfront resort inspired by traditional Sasak architecture',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const dto = adminAccommodationsService.mapToDto(rawAccommodation);

    expect(dto.translations).toHaveLength(2);
    expect(dto.availableLocales).toEqual(['id-ID', 'en-US']);
    expect(dto.missingLocales).toEqual([]);
  });

  it('should map ItineraryTemplate translations and compute locale availability', () => {
    const rawTemplate: any = {
      id: 'tmpl-1',
      title: 'Jelajah Lombok Selatan 3 Hari',
      description: 'Rute pantai terindah di Lombok Selatan',
      transportPaceNote: 'Perjalanan santai dengan mobil sewaan',
      translations: [
        {
          locale: 'id-ID',
          title: 'Jelajah Lombok Selatan 3 Hari',
          description: 'Rute pantai terindah di Lombok Selatan',
          transportPaceNote: 'Perjalanan santai dengan mobil sewaan',
        },
      ],
    };

    const dto = adminItineraryTemplatesService.formatTemplate(rawTemplate);

    expect(dto.translations).toHaveLength(1);
    expect(dto.availableLocales).toEqual(['id-ID']);
    expect(dto.missingLocales).toEqual(['en-US']);
  });
});

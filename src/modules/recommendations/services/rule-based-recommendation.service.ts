import { BudgetLevel, Category, Destination, DestinationImage, TravelStyle } from '@prisma/client';
import { prisma } from '../../../database/prisma';
import { RecommendationContext, ScoredRecommendation } from '../dto/recommendation.dto';
import { IRecommendationEngine } from './recommendation-engine.interface';
import { destinationsService } from '../../destinations/destinations.service';

type DestinationWithRelations = Destination & {
  category: Category;
  images: DestinationImage[];
  _count?: { reviews: number; favorites: number };
};

export class RuleBasedRecommendationService implements IRecommendationEngine {
  public getEngineName(): string {
    return 'RuleBasedRecommendationEngine';
  }

  private calculateHaversineDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  private parseJsonArray(jsonStr: string | null | undefined): string[] {
    if (!jsonStr) return [];
    try {
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return jsonStr ? [jsonStr] : [];
    }
  }

  public async getRecommendations(context: RecommendationContext): Promise<ScoredRecommendation[]> {
    // 1. Fetch user's personalization history if authenticated
    const userFavoriteCategoryIds = new Set<string>();
    const userFavoriteTags = new Set<string>();
    const favoritedDestinationIds = new Set<string>();

    if (context.userId) {
      const [favorites, highRatedReviews] = await Promise.all([
        prisma.favorite.findMany({
          where: { userId: context.userId },
          include: {
            destination: {
              include: { category: true },
            },
          },
        }),
        prisma.review.findMany({
          where: { userId: context.userId, rating: { gte: 4 }, deletedAt: null },
          include: {
            destination: {
              include: { category: true },
            },
          },
          take: 10,
        }),
      ]);

      for (const fav of favorites) {
        favoritedDestinationIds.add(fav.destinationId);
        if (fav.destination?.categoryId) {
          userFavoriteCategoryIds.add(fav.destination.categoryId);
        }
        const tags = this.parseJsonArray(fav.destination?.tags);
        tags.forEach((t) => userFavoriteTags.add(t.toLowerCase()));
      }

      for (const rev of highRatedReviews) {
        if (rev.destination?.categoryId) {
          userFavoriteCategoryIds.add(rev.destination.categoryId);
        }
      }
    }

    // 2. Fetch candidate destinations with safety limit and query filter pushdown
    const candidateLimit = context.limit ? Math.max(context.limit * 5, 50) : 100;
    const destinations = (await prisma.destination.findMany({
      where: {
        deletedAt: null,
        ...(context.category && {
          OR: [
            { categoryId: context.category },
            { category: { slug: context.category.toLowerCase() } },
          ],
        }),
      },
      take: candidateLimit,
      include: {
        category: true,
        images: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: { reviews: true, favorites: true },
        },
      },
    })) as DestinationWithRelations[];

    // 3. Score each destination based on rule matrix
    const scoredList: ScoredRecommendation[] = [];

    for (const dest of destinations) {
      let score = 0;
      const matchReasons: string[] = [];

      const tags = this.parseJsonArray(dest.tags).map((t) => t.toLowerCase());
      const catSlug = dest.category.slug.toLowerCase();
      const entranceFee = Number(dest.entranceFee) || 0;

      // Base Popularity & Quality Score
      const ratingBonus = dest.rating * 10;
      const reviewVolumeBonus = Math.log10(dest.reviewCount + 1) * 6;
      score += ratingBonus + reviewVolumeBonus;

      if (dest.rating >= 4.7 && dest.reviewCount >= 10) {
        matchReasons.push(
          `Rating sangat tinggi (${dest.rating.toFixed(1)}★ dari ${dest.reviewCount} ulasan)`,
        );
      }

      if (dest.isFeatured) {
        score += 15;
        matchReasons.push('Destinasi pilihan unggulan Lombok');
      }

      // Rule 1: User Favorite & Activity Affinity (Personalized)
      if (userFavoriteCategoryIds.has(dest.categoryId)) {
        score += 30;
        matchReasons.push(`Serupa dengan kategori wisata ${dest.category.name} yang kamu sukai`);
      }

      let tagMatchCount = 0;
      for (const t of tags) {
        if (userFavoriteTags.has(t)) {
          tagMatchCount++;
        }
      }
      if (tagMatchCount > 0) {
        score += Math.min(tagMatchCount * 10, 25);
        matchReasons.push('Sesuai preferensi aktivitas favoritmu');
      }

      // Rule 2: Explicit Travel Style Match
      if (context.travelStyle) {
        if (
          context.travelStyle === TravelStyle.BEACH_RELAXATION &&
          (catSlug === 'beach' ||
            catSlug === 'gili' ||
            catSlug === 'snorkeling' ||
            catSlug === 'sunset')
        ) {
          score += 30;
          matchReasons.push('Sangat cocok untuk gaya liburan pantai & relaksasi');
        } else if (
          context.travelStyle === TravelStyle.NATURE_ADVENTURE &&
          (catSlug === 'waterfall' ||
            catSlug === 'mountain' ||
            catSlug === 'hill' ||
            catSlug === 'adventure')
        ) {
          score += 30;
          matchReasons.push('Destinasi petualangan alam & trekking favorit');
        } else if (
          context.travelStyle === TravelStyle.CULTURE_HERITAGE &&
          (catSlug === 'culture' || catSlug === 'village')
        ) {
          score += 30;
          matchReasons.push('Eksplorasi warisan budaya otentik Sasak');
        } else if (
          context.travelStyle === TravelStyle.CULINARY_EXPLORER &&
          catSlug === 'culinary'
        ) {
          score += 35;
          matchReasons.push('Pusat kuliner legendaris khas Lombok');
        } else if (
          context.travelStyle === TravelStyle.PHOTOGRAPHY_SPOTS &&
          (catSlug === 'sunset' || catSlug === 'hill' || catSlug === 'waterfall')
        ) {
          score += 30;
          matchReasons.push('Spot foto pemandangan terbaik & instagramable');
        } else if (
          context.travelStyle === TravelStyle.FAMILY_FRIENDLY &&
          dest.difficulty === 'EASY'
        ) {
          score += 25;
          matchReasons.push('Akses ramah keluarga dan anak-anak');
        }
      }

      // Rule 3: Explicit Category Match
      if (context.category) {
        const queryCat = context.category.toLowerCase().trim();
        if (catSlug.includes(queryCat) || dest.category.name.toLowerCase().includes(queryCat)) {
          score += 40;
          matchReasons.push(`Kategori sesuai pencarianmu: ${dest.category.name}`);
        }
      }

      // Rule 4: Budget Level Match
      if (context.budgetLevel) {
        if (context.budgetLevel === BudgetLevel.BUDGET && entranceFee <= 20000) {
          score += 20;
          matchReasons.push('Tiket masuk sangat terjangkau / gratis');
        } else if (context.budgetLevel === BudgetLevel.MID_RANGE && entranceFee <= 100000) {
          score += 15;
          matchReasons.push('Biaya standar dan fasilitas lengkap');
        } else if (context.budgetLevel === BudgetLevel.LUXURY) {
          score += 15;
        }
      }

      // Rule 5: Distance & Proximity calculation
      let distanceKm: number | undefined;
      if (context.latitude !== undefined && context.longitude !== undefined) {
        distanceKm = this.calculateHaversineDistanceKm(
          context.latitude,
          context.longitude,
          dest.latitude,
          dest.longitude,
        );

        if (context.radiusKm !== undefined && distanceKm > context.radiusKm) {
          // Beyond radius: apply penalty
          score -= (distanceKm - context.radiusKm) * 2;
        } else {
          // Proximity bonus: closer gives higher bonus
          const proximityBonus = Math.max(0, 25 - distanceKm * 0.4);
          score += proximityBonus;
          if (distanceKm <= 15) {
            matchReasons.push(`Dekat dengan lokasimu (${distanceKm} km)`);
          }
        }
      }

      // Ensure at least one default match reason
      if (matchReasons.length === 0) {
        matchReasons.push('Destinasi populer yang direkomendasikan wisatawan');
      }

      const destinationDto = destinationsService.mapToDto(dest);

      scoredList.push({
        destination: destinationDto,
        score: Math.round(score * 10) / 10,
        matchReasons: matchReasons.slice(0, 3), // Top 3 reasons
        distanceKm,
      });
    }

    // 4. Sort by score descending and take requested limit
    scoredList.sort((a, b) => b.score - a.score);

    return scoredList.slice(0, context.limit);
  }
}

export const ruleBasedRecommendationService = new RuleBasedRecommendationService();

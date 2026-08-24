import { describe, it, expect } from 'vitest';

interface DestinationCandidate {
  id: string;
  name: string;
  categorySlug: string;
  rating: number;
  viewCount: number;
  latitude: number;
  longitude: number;
}

/**
 * Pure Rule-Based Recommendation Scoring Engine Unit
 */
class RuleBasedScorer {
  public static calculateAffinityScore(
    destination: DestinationCandidate,
    userInterests: string[],
    userFavoriteCategories: string[],
    userLocation?: { lat: number; lng: number },
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // 1. Rating component (0 to 25 points)
    const ratingScore = (destination.rating / 5.0) * 25;
    score += ratingScore;
    if (destination.rating >= 4.7) {
      reasons.push(`Top rated destination (${destination.rating.toFixed(1)} ★)`);
    }

    // 2. Popularity log scaling (0 to 20 points)
    // Normalized assuming max 10,000 views
    const logPopularity = Math.log10(destination.viewCount + 1);
    const popularityScore = Math.min(20, (logPopularity / 4.0) * 20);
    score += popularityScore;
    if (destination.viewCount > 1000) {
      reasons.push('Popular among travelers');
    }

    // 3. User Category Interests (+30 points)
    if (userInterests.includes(destination.categorySlug)) {
      score += 30;
      reasons.push(`Matches your interest in ${destination.categorySlug}`);
    }

    // 4. User Favorite History Affinity (+25 points)
    if (userFavoriteCategories.includes(destination.categorySlug)) {
      score += 25;
      reasons.push(`Similar to destinations you saved in favorites`);
    }

    // 5. Proximity Component (0 to 20 points)
    if (userLocation) {
      const distance = this.haversine(
        userLocation.lat,
        userLocation.lng,
        destination.latitude,
        destination.longitude,
      );
      if (distance <= 50) {
        const proxScore = ((50 - distance) / 50) * 20;
        score += proxScore;
        if (distance <= 15) {
          reasons.push(`Nearby your location (${distance.toFixed(1)} km)`);
        }
      }
    }

    return { score: Math.round(score * 100) / 100, reasons };
  }

  private static haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

describe('Unit Test: Recommendation Engine Scoring Algorithm (Phase 21)', () => {
  const candidateBeach: DestinationCandidate = {
    id: 'dest-1',
    name: 'Tanjung Aan Beach',
    categorySlug: 'beach',
    rating: 4.9,
    viewCount: 5000,
    latitude: -8.9056,
    longitude: 116.3194,
  };

  const candidateMountain: DestinationCandidate = {
    id: 'dest-2',
    name: 'Mount Rinjani',
    categorySlug: 'mountain-hiking',
    rating: 4.8,
    viewCount: 8000,
    latitude: -8.4113,
    longitude: 116.4573,
  };

  it('should give higher recommendation score to destination matching user category interest', () => {
    const scoreForBeachLover = RuleBasedScorer.calculateAffinityScore(
      candidateBeach,
      ['beach'], // User interested in beach
      [],
    );

    const scoreForMountainLover = RuleBasedScorer.calculateAffinityScore(
      candidateBeach,
      ['mountain-hiking'], // User interested in mountain
      [],
    );

    expect(scoreForBeachLover.score).toBeGreaterThan(scoreForMountainLover.score);
    expect(scoreForBeachLover.reasons).toContain('Matches your interest in beach');
  });

  it('should give affinity boost to categories that user previously favorited', () => {
    const scoreWithFav = RuleBasedScorer.calculateAffinityScore(
      candidateBeach,
      [],
      ['beach'], // User has favorited beach before
    );

    const scoreWithoutFav = RuleBasedScorer.calculateAffinityScore(candidateBeach, [], []);

    expect(scoreWithFav.score).toBeGreaterThan(scoreWithoutFav.score);
    expect(scoreWithFav.reasons).toContain('Similar to destinations you saved in favorites');
  });

  it('should boost destination score when nearby user coordinates', () => {
    // User is currently in Kuta Lombok (very close to Tanjung Aan Beach ~ 6km)
    const kutaLombok = { lat: -8.8911, lng: 116.2825 };

    const scoreNearby = RuleBasedScorer.calculateAffinityScore(
      candidateBeach,
      [],
      [],
      kutaLombok,
    );

    const scoreWithoutLoc = RuleBasedScorer.calculateAffinityScore(candidateBeach, [], []);

    expect(scoreNearby.score).toBeGreaterThan(scoreWithoutLoc.score);
    expect(scoreNearby.reasons.some((r) => r.includes('Nearby your location'))).toBe(true);
  });

  it('should handle cold-start users (empty history, no interests) gracefully', () => {
    const result = RuleBasedScorer.calculateAffinityScore(candidateBeach, [], []);

    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons).toContain('Top rated destination (4.9 ★)');
    expect(result.reasons).toContain('Popular among travelers');
  });
});

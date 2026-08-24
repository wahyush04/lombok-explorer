import {
  RecommendationContext,
  RecommendationQuery,
  RecommendationResponseDto,
} from './dto/recommendation.dto';
import { IRecommendationEngine } from './services/recommendation-engine.interface';
import { ruleBasedRecommendationService } from './services/rule-based-recommendation.service';

export class RecommendationsService {
  private engine: IRecommendationEngine;

  constructor(engine: IRecommendationEngine = ruleBasedRecommendationService) {
    this.engine = engine;
  }

  /**
   * Allows hot-swapping or dynamically injecting recommendation engines (e.g. RuleBased vs AI).
   */
  public setEngine(engine: IRecommendationEngine): void {
    this.engine = engine;
  }

  public getActiveEngineName(): string {
    return this.engine.getEngineName();
  }

  public async getRecommendations(
    query: RecommendationQuery,
    userId?: string,
  ): Promise<RecommendationResponseDto> {
    const travelStyle = query.travel_style || query.travelStyle;
    const budgetLevel = query.budget_level || query.budgetLevel;
    const latitude = query.latitude ?? query.lat;
    const longitude = query.longitude ?? query.lng;
    const radiusKm = query.radius_km ?? query.radiusKm ?? 100;
    const limit = query.limit ?? 6;

    const context: RecommendationContext = {
      userId,
      travelStyle,
      budgetLevel,
      category: query.category,
      latitude,
      longitude,
      radiusKm,
      limit,
    };

    const recommendations = await this.engine.getRecommendations(context);

    return {
      recommendations,
      meta: {
        total: recommendations.length,
        engine: this.engine.getEngineName(),
        personalized: Boolean(userId),
        travelStyle,
        budgetLevel,
      },
    };
  }
}

export const recommendationsService = new RecommendationsService();

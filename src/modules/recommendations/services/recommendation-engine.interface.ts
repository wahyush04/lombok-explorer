import { RecommendationContext, ScoredRecommendation } from '../dto/recommendation.dto';

export interface IRecommendationEngine {
  /**
   * Generates a ranked list of recommended destinations based on user context and preferences.
   */
  getRecommendations(context: RecommendationContext): Promise<ScoredRecommendation[]>;

  /**
   * Unique name of the recommendation engine (e.g., 'RuleBasedRecommendationEngine', 'AIRecommendationEngine').
   */
  getEngineName(): string;
}

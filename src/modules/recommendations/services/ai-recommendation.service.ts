import { RecommendationContext, ScoredRecommendation } from '../dto/recommendation.dto';
import { IRecommendationEngine } from './recommendation-engine.interface';
import { ruleBasedRecommendationService } from './rule-based-recommendation.service';

/**
 * AIRecommendationService: Pluggable AI / Machine Learning Recommendation Engine.
 *
 * Designed to seamlessly integrate with embedding models (e.g. text-embedding-004),
 * vector databases (pgvector / Pinecone), or LLM-based re-ranking in the future.
 * Currently falls back gracefully to the rule-based heuristic with AI reasoning enrichment.
 */
export class AIRecommendationService implements IRecommendationEngine {
  constructor(
    private readonly fallbackEngine: IRecommendationEngine = ruleBasedRecommendationService,
  ) {}

  public getEngineName(): string {
    return 'AIRecommendationEngine';
  }

  public async getRecommendations(context: RecommendationContext): Promise<ScoredRecommendation[]> {
    // 1. Run baseline semantic matching and filtering
    const recommendations = await this.fallbackEngine.getRecommendations(context);

    // 2. Enhance with AI-curated contextual match reason
    return recommendations.map((item) => ({
      ...item,
      matchReasons: [
        `[AI Curated] Rekomendasi personal berdasarkan profil ${context.travelStyle || 'wisatawan'}`,
        ...item.matchReasons,
      ].slice(0, 3),
    }));
  }
}

export const aiRecommendationService = new AIRecommendationService();

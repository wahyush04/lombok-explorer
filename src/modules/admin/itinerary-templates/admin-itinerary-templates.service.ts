import { NotFoundError } from '../../../common/errors/app-error';
import { PaginationMeta } from '../../../common/types';
import {
  AdminTemplateFilterQuery,
  CreateItineraryTemplateInput,
  UpdateItineraryTemplateInput,
} from './dto/admin-itinerary-template.dto';
import {
  AdminItineraryTemplatesRepository,
  adminItineraryTemplatesRepository,
} from './admin-itinerary-templates.repository';

export class AdminItineraryTemplatesService {
  constructor(
    private readonly repository: AdminItineraryTemplatesRepository = adminItineraryTemplatesRepository,
  ) {}

  public async getTemplates(query: AdminTemplateFilterQuery): Promise<{
    data: unknown[];
    meta: PaginationMeta;
  }> {
    const { items, total } = await this.repository.findMany(query);
    const totalPages = Math.ceil(total / query.limit) || 1;

    return {
      data: items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  public async getTemplateById(id: string): Promise<unknown> {
    const template = await this.repository.findById(id);
    if (!template) {
      throw new NotFoundError(`Itinerary template with ID '${id}' not found`, 'TEMPLATE_NOT_FOUND');
    }
    return template;
  }

  public async createTemplate(data: CreateItineraryTemplateInput): Promise<unknown> {
    return this.repository.create(data);
  }

  public async updateTemplate(id: string, data: UpdateItineraryTemplateInput): Promise<unknown> {
    await this.getTemplateById(id);
    return this.repository.update(id, data);
  }

  public async deleteTemplate(id: string): Promise<{ success: boolean; message: string }> {
    await this.getTemplateById(id);
    await this.repository.delete(id);
    return { success: true, message: 'Itinerary template deleted successfully' };
  }
}

export const adminItineraryTemplatesService = new AdminItineraryTemplatesService();

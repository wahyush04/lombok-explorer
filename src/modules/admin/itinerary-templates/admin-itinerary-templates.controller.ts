import { Request, Response } from 'express';
import { asyncHandler } from '../../../common/utils/async-handler.util';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import {
  AdminItineraryTemplatesService,
  adminItineraryTemplatesService,
} from './admin-itinerary-templates.service';
import {
  AdminTemplateFilterQuery,
  CreateItineraryTemplateInput,
  UpdateItineraryTemplateInput,
} from './dto/admin-itinerary-template.dto';

export class AdminItineraryTemplatesController {
  constructor(
    private readonly service: AdminItineraryTemplatesService = adminItineraryTemplatesService,
  ) {}

  public getTemplates = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as AdminTemplateFilterQuery;
    const { data, meta } = await this.service.getTemplates(query);
    return ResponseUtil.sendPaginated(
      res,
      data,
      meta,
      'Itinerary templates retrieved successfully',
    );
  });

  public getTemplateById = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const data = await this.service.getTemplateById(id);
    return ResponseUtil.sendSuccess(res, data, 'Itinerary template retrieved successfully');
  });

  public createTemplate = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as CreateItineraryTemplateInput;
    const data = await this.service.createTemplate(body, req.user?.userId);
    return ResponseUtil.sendCreated(res, data, 'Itinerary template created successfully');
  });

  public updateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const body = req.body as UpdateItineraryTemplateInput;
    const data = await this.service.updateTemplate(id, body, req.user?.userId);
    return ResponseUtil.sendSuccess(res, data, 'Itinerary template updated successfully');
  });

  public deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const result = await this.service.deleteTemplate(id);
    return ResponseUtil.sendSuccess(res, result, result.message);
  });
}

export const adminItineraryTemplatesController = new AdminItineraryTemplatesController();

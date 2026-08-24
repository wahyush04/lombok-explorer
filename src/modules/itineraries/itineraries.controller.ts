import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { itinerariesService, ItinerariesService } from './itineraries.service';
import {
  itineraryGeneratorService,
  ItineraryGeneratorService,
} from './itinerary-generator.service';
import { CreateItineraryDto, ItineraryQuery, UpdateItineraryDto } from './dto/itinerary.dto';
import { GenerateItineraryDto } from './dto/itinerary-generator.dto';

export class ItinerariesController {
  constructor(
    private readonly service: ItinerariesService = itinerariesService,
    private readonly generatorService: ItineraryGeneratorService = itineraryGeneratorService,
  ) {}

  public getItineraries = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ItineraryQuery;
    const userId = req.user?.userId;
    const { data, meta } = await this.service.getItineraries(query, userId);
    return ResponseUtil.sendPaginated(res, data, meta, 'Success fetching itineraries');
  });

  public getById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const itinerary = await this.service.getItineraryById(id, userId, userRole);
    return ResponseUtil.sendSuccess(res, itinerary, 'Success fetching itinerary detail');
  });

  public createItinerary = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const dto = req.body as CreateItineraryDto;
    const data = await this.service.createItinerary(userId, dto);
    return ResponseUtil.sendCreated(res, data, 'Itinerary created successfully');
  });

  public generateItinerary = asyncHandler(async (req: Request, res: Response) => {
    const dto = req.body as GenerateItineraryDto;
    const userId = req.user?.userId;
    const result = await this.generatorService.generateItinerary(dto, userId);
    return ResponseUtil.sendSuccess(res, result, 'Smart itinerary generated successfully');
  });

  public updateItinerary = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const dto = req.body as UpdateItineraryDto;
    const data = await this.service.updateItinerary(userId, userRole, id, dto);
    return ResponseUtil.sendSuccess(res, data, 'Itinerary updated successfully');
  });

  public deleteItinerary = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    await this.service.deleteItinerary(userId, userRole, id);
    return ResponseUtil.sendActionSuccess(res, 'Itinerary deleted successfully');
  });
}

export const itinerariesController = new ItinerariesController();

import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { itinerariesService, ItinerariesService } from './itineraries.service';
import {
  itineraryGeneratorService,
  ItineraryGeneratorService,
} from './itinerary-generator.service';
import {
  AddActivityDto,
  AddDayDto,
  CreateItineraryDto,
  ItineraryQuery,
  OptimizeItineraryDto,
  ReorderActivitiesDto,
  UpdateActivityDto,
  UpdateDayDto,
  UpdateItineraryDto,
} from './dto/itinerary.dto';
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
    return ResponseUtil.sendPaginated(res, data, meta, 'Itineraries retrieved successfully');
  });

  public getById = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const itinerary = await this.service.getItineraryById(id, userId, userRole);
    return ResponseUtil.sendSuccess(res, itinerary, 'Itinerary detail retrieved successfully');
  });

  public getSharedItinerary = asyncHandler(async (req: Request, res: Response) => {
    const shareToken = String(req.params.shareToken);
    const itinerary = await this.service.getSharedItinerary(shareToken);
    return ResponseUtil.sendSuccess(res, itinerary, 'Shared itinerary retrieved successfully');
  });

  public createItinerary = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const dto = req.body as CreateItineraryDto;
    const data = await this.service.createItinerary(userId, dto);
    return ResponseUtil.sendCreated(res, data, 'Itinerary trip created successfully');
  });

  public updateItinerary = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const dto = req.body as UpdateItineraryDto;
    const data = await this.service.updateItinerary(userId, userRole, id, dto);
    return ResponseUtil.sendSuccess(res, data, 'Itinerary updated successfully');
  });

  public deleteItinerary = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    await this.service.deleteItinerary(userId, userRole, id);
    return ResponseUtil.sendActionSuccess(res, 'Itinerary deleted successfully');
  });

  public duplicateItinerary = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const userId = req.user!.userId;
    const data = await this.service.duplicateItinerary(userId, id);
    return ResponseUtil.sendCreated(res, data, 'Itinerary duplicated successfully');
  });

  public generateShareToken = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const data = await this.service.generateShareToken(userId, userRole, id);
    return ResponseUtil.sendSuccess(res, data, 'Share link generated successfully');
  });

  // --- DAY CONTROLLERS ---
  public addDay = asyncHandler(async (req: Request, res: Response) => {
    const itineraryId = String(req.params.id);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const dto = req.body as AddDayDto;
    const data = await this.service.addDay(userId, userRole, itineraryId, dto);
    return ResponseUtil.sendCreated(res, data, 'Day added to itinerary successfully');
  });

  public updateDay = asyncHandler(async (req: Request, res: Response) => {
    const itineraryId = String(req.params.id);
    const dayId = String(req.params.dayId);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const dto = req.body as UpdateDayDto;
    const data = await this.service.updateDay(userId, userRole, itineraryId, dayId, dto);
    return ResponseUtil.sendSuccess(res, data, 'Day updated successfully');
  });

  public deleteDay = asyncHandler(async (req: Request, res: Response) => {
    const itineraryId = String(req.params.id);
    const dayId = String(req.params.dayId);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const data = await this.service.deleteDay(userId, userRole, itineraryId, dayId);
    return ResponseUtil.sendSuccess(res, data, 'Day deleted and re-indexed successfully');
  });

  // --- ACTIVITY / STOP CONTROLLERS ---
  public addActivity = asyncHandler(async (req: Request, res: Response) => {
    const itineraryId = String(req.params.id);
    const dayId = String(req.params.dayId);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const dto = req.body as AddActivityDto;
    const data = await this.service.addActivity(userId, userRole, itineraryId, dayId, dto);
    return ResponseUtil.sendCreated(res, data, 'Stop activity added successfully');
  });

  public updateActivity = asyncHandler(async (req: Request, res: Response) => {
    const itineraryId = String(req.params.id);
    const dayId = String(req.params.dayId);
    const activityId = String(req.params.activityId);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const dto = req.body as UpdateActivityDto;
    const data = await this.service.updateActivity(userId, userRole, itineraryId, dayId, activityId, dto);
    return ResponseUtil.sendSuccess(res, data, 'Stop activity updated successfully');
  });

  public deleteActivity = asyncHandler(async (req: Request, res: Response) => {
    const itineraryId = String(req.params.id);
    const dayId = String(req.params.dayId);
    const activityId = String(req.params.activityId);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const data = await this.service.deleteActivity(userId, userRole, itineraryId, dayId, activityId);
    return ResponseUtil.sendSuccess(res, data, 'Stop activity deleted and route recalculation completed');
  });

  public reorderActivities = asyncHandler(async (req: Request, res: Response) => {
    const itineraryId = String(req.params.id);
    const dayId = String(req.params.dayId);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const dto = req.body as ReorderActivitiesDto;
    const data = await this.service.reorderActivities(userId, userRole, itineraryId, dayId, dto);
    return ResponseUtil.sendSuccess(res, data, 'Stop activities reordered and route recalculation completed');
  });

  // --- ROUTE OPTIMIZATION ---
  public optimizeRoute = asyncHandler(async (req: Request, res: Response) => {
    const itineraryId = String(req.params.id);
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const dto = req.body as OptimizeItineraryDto;
    const data = await this.service.optimizeRoute(userId, userRole, itineraryId, dto);
    return ResponseUtil.sendSuccess(res, data, 'Route optimization completed successfully');
  });

  public generateItinerary = asyncHandler(async (req: Request, res: Response) => {
    const dto = req.body as GenerateItineraryDto;
    const userId = req.user?.userId;
    const result = await this.generatorService.generateItinerary(dto, userId);
    return ResponseUtil.sendSuccess(res, result, 'Smart itinerary generated successfully');
  });
}

export const itinerariesController = new ItinerariesController();

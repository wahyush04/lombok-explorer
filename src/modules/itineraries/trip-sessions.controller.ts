import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { tripSessionsService, TripSessionsService } from './trip-sessions.service';
import {
  CompleteActivityDto,
  SkipActivityDto,
  StartActivityDto,
  StartTripDto,
  SyncLocationDto,
} from './dto/trip-session.dto';

export class TripSessionsController {
  constructor(private readonly service: TripSessionsService = tripSessionsService) {}

  public startTrip = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const itineraryId = String(req.params.id || (req.body as StartTripDto)?.itineraryId);
    const dto = req.body as StartTripDto;
    const result = await this.service.startTrip(userId, itineraryId, dto);
    return ResponseUtil.sendCreated(res, result, 'Trip session started successfully');
  });

  public getActiveSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await this.service.getActiveSession(userId);
    if (!result) {
      return ResponseUtil.sendSuccess(
        res,
        { hasActiveTrip: false, session: null },
        'No active trip session found',
      );
    }
    return ResponseUtil.sendSuccess(
      res,
      { hasActiveTrip: true, ...result },
      'Active trip session retrieved successfully',
    );
  });

  public getSessionById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const sessionId = String(req.params.id);
    const result = await this.service.getSessionById(userId, sessionId);
    return ResponseUtil.sendSuccess(res, result, 'Trip session retrieved successfully');
  });

  public syncLocation = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const sessionId = String(req.params.id);
    const dto = req.body as SyncLocationDto;
    const result = await this.service.syncLocation(userId, sessionId, dto);
    return ResponseUtil.sendSuccess(res, result, 'Trip location synced successfully');
  });

  public startActivity = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const sessionId = String(req.params.id);
    const activityId = String(req.params.activityId);
    const dto = req.body as StartActivityDto;
    const result = await this.service.startActivity(userId, sessionId, activityId, dto);
    return ResponseUtil.sendSuccess(res, result, 'Activity started successfully');
  });

  public completeActivity = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const sessionId = String(req.params.id);
    const activityId = String(req.params.activityId);
    const dto = req.body as CompleteActivityDto;
    const result = await this.service.completeActivity(userId, sessionId, activityId, dto);
    return ResponseUtil.sendSuccess(res, result, 'Activity marked as completed successfully');
  });

  public skipActivity = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const sessionId = String(req.params.id);
    const activityId = String(req.params.activityId);
    const dto = req.body as SkipActivityDto;
    const result = await this.service.skipActivity(userId, sessionId, activityId, dto);
    return ResponseUtil.sendSuccess(res, result, 'Activity skipped successfully');
  });

  public finishTrip = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const sessionId = String(req.params.id);
    const result = await this.service.finishTrip(userId, sessionId);
    return ResponseUtil.sendSuccess(res, result, 'Trip session finished successfully');
  });

  public cancelTrip = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const sessionId = String(req.params.id);
    const result = await this.service.cancelTrip(userId, sessionId);
    return ResponseUtil.sendSuccess(res, result, 'Trip session cancelled successfully');
  });
}

export const tripSessionsController = new TripSessionsController();

import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { HttpStatus } from '../../common/constants';
import { devicesService, DevicesService } from './devices.service';
import { DeactivateDeviceTokenDto, RegisterDeviceTokenDto } from './dto/device.dto';

export class DevicesController {
  constructor(private readonly service: DevicesService = devicesService) {}

  public registerToken = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const body = req.body as RegisterDeviceTokenDto;
    const result = await this.service.registerToken(userId, body);
    return ResponseUtil.sendSuccess(
      res,
      result,
      'Device token registered successfully',
      HttpStatus.OK,
    );
  });

  public deactivateToken = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const body = req.body as DeactivateDeviceTokenDto;
    await this.service.deactivateToken(userId, body.token);
    return ResponseUtil.sendActionSuccess(res, 'Device token deactivated successfully');
  });
}

export const devicesController = new DevicesController();

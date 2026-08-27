import { Request, Response } from 'express';
import { HttpStatus } from '../../common/constants';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { CheckUsernameQueryDto, UpdateProfileDto } from './dto/user.dto';
import { usersService, UsersService } from './users.service';

export class UsersController {
  constructor(private readonly service: UsersService = usersService) {}

  public checkUsername = asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as CheckUsernameQueryDto;
    const result = await this.service.checkUsername(query.username);
    return ResponseUtil.sendSuccess(res, result, 'Username availability status checked', HttpStatus.OK);
  });

  public getMe = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const user = await this.service.getProfile(userId);
    return ResponseUtil.sendSuccess(res, user, 'User profile retrieved successfully', HttpStatus.OK);
  });

  public updateMe = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const dto = req.body as UpdateProfileDto;
    const updatedUser = await this.service.updateProfile(userId, dto);
    return ResponseUtil.sendSuccess(res, updatedUser, 'User profile updated successfully', HttpStatus.OK);
  });
}

export const usersController = new UsersController();

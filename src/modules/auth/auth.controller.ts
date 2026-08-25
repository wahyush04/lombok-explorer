import { Request, Response } from 'express';
import { asyncHandler } from '../../common/utils/async-handler.util';
import { ResponseUtil } from '../../common/utils/api-response.util';
import { authService, AuthService } from './auth.service';
import { GoogleAuthDto, LoginDto, RefreshTokenDto, RegisterDto } from './dto/auth.dto';
import { HttpStatus } from '../../common/constants';

export class AuthController {
  constructor(private readonly service: AuthService = authService) {}

  public register = asyncHandler(async (req: Request, res: Response) => {
    const dto = req.body as RegisterDto;
    const result = await this.service.register(dto);
    return ResponseUtil.sendSuccess(
      res,
      result,
      'User account registered successfully',
      HttpStatus.CREATED,
    );
  });

  public login = asyncHandler(async (req: Request, res: Response) => {
    const dto = req.body as LoginDto;
    const result = await this.service.login(dto);
    return ResponseUtil.sendSuccess(res, result, 'Authentication successful');
  });

  public googleLogin = asyncHandler(async (req: Request, res: Response) => {
    const dto = req.body as GoogleAuthDto;
    const result = await this.service.googleLogin(dto);
    return ResponseUtil.sendSuccess(res, result, 'Login successful');
  });

  public refresh = asyncHandler(async (req: Request, res: Response) => {
    const dto = req.body as RefreshTokenDto;
    const result = await this.service.refreshToken(dto);
    return ResponseUtil.sendSuccess(res, result, 'Token refreshed successfully');
  });

  public logout = asyncHandler(async (req: Request, res: Response) => {
    if (req.user?.userId) {
      await this.service.logout(req.user.userId);
    }
    return ResponseUtil.sendActionSuccess(res, 'Logged out successfully');
  });

  public getMe = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const user = await this.service.getMe(userId);
    return ResponseUtil.sendSuccess(res, user, 'User profile retrieved successfully');
  });
}

export const authController = new AuthController();

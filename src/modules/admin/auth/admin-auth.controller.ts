import { Request, Response } from 'express';
import { authService, AuthService } from '../../auth/auth.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import { ForbiddenError } from '../../../common/errors/app-error';
import { LoginDto, RefreshTokenDto } from '../../auth/dto/auth.dto';

export class AdminAuthController {
  constructor(private readonly service: AuthService = authService) {}

  public login = async (req: Request<unknown, unknown, LoginDto>, res: Response): Promise<void> => {
    const result = await this.service.adminLogin(req.body);
    ResponseUtil.sendSuccess(res, result, 'Login successful');
  };

  public refreshToken = async (
    req: Request<unknown, unknown, RefreshTokenDto>,
    res: Response,
  ): Promise<void> => {
    const result = await this.service.refreshToken(req.body);

    // Ensure the refreshed user is an ADMIN
    if (result.user.role !== 'ADMIN') {
      // Clear token to prevent escalation
      await this.service.logout(result.user.id);
      throw new ForbiddenError('Admin access required', 'ADMIN_ACCESS_REQUIRED');
    }

    ResponseUtil.sendSuccess(res, result, 'Token refreshed successfully');
  };

  public logout = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    await this.service.logout(userId);
    ResponseUtil.sendActionSuccess(res, 'Logout successful');
  };

  public getMe = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const user = await this.service.getMe(userId);

    if (user.role !== 'ADMIN') {
      throw new ForbiddenError('Admin access required', 'ADMIN_ACCESS_REQUIRED');
    }

    ResponseUtil.sendSuccess(res, user, 'Admin profile retrieved successfully');
  };
}

export const adminAuthController = new AdminAuthController();

import { Request, Response } from 'express';
import { adminUsersService, AdminUsersService } from './admin-users.service';
import { ResponseUtil } from '../../../common/utils/api-response.util';
import {
  AdminUserFilterQuery,
  DeleteUserQueryDto,
  UpdateUserDto,
  UpdateUserStatusDto,
} from './dto/admin-user.dto';

export class AdminUsersController {
  constructor(private readonly service: AdminUsersService = adminUsersService) {}

  public getUsers = async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AdminUserFilterQuery;
    const { data, meta } = await this.service.getUsers(query);
    ResponseUtil.sendPaginated(res, data, meta, 'Users retrieved successfully');
  };

  public getUserById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const data = await this.service.getUserById(id as string);
    ResponseUtil.sendSuccess(res, data, 'User details retrieved successfully');
  };

  public updateUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const body = req.body as UpdateUserDto;
    const data = await this.service.updateUser(
      id as string,
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendSuccess(res, data, 'User updated successfully');
  };

  public updateUserStatus = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const body = req.body as UpdateUserStatusDto;
    const data = await this.service.updateUserStatus(
      id as string,
      body,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendSuccess(res, data, 'User status updated successfully');
  };

  public deleteUser = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const query = req.query as unknown as DeleteUserQueryDto;
    await this.service.deleteUser(
      id as string,
      query.hard,
      req.user?.userId,
      req.ip,
      req.headers['user-agent'] as string | undefined,
    );
    ResponseUtil.sendActionSuccess(res, 'User deleted successfully');
  };
}

export const adminUsersController = new AdminUsersController();

import { Prisma, User } from '@prisma/client';
import { prisma } from '../../database/prisma';

export class UsersRepository {
  public async findById(id: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  public async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        username: username.toLowerCase().trim(),
        deletedAt: null,
      },
    });
  }

  public async findByUsernameExcludingUser(
    username: string,
    excludeUserId: string,
  ): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        username: username.toLowerCase().trim(),
        id: { not: excludeUserId },
        deletedAt: null,
      },
    });
  }

  public async updateProfile(userId: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }
}

export const usersRepository = new UsersRepository();

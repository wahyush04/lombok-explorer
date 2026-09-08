import { Prisma, User } from '@prisma/client';
import { prisma } from '../../database/prisma';

export class UsersRepository {
  public async findById(id: string, includeDeleted = false): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
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

  public async updatePassword(userId: string, passwordHash: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        refreshToken: null, // Invalidate active refresh token sessions
      },
    });
  }

  public async softDeleteUser(userId: string): Promise<User> {
    return prisma.$transaction(async (tx) => {
      // 1. Invalidate device tokens
      await tx.deviceToken.deleteMany({
        where: { userId },
      });

      // 2. Soft-delete user active posts to prevent broken/ghost feeds
      await tx.post.updateMany({
        where: {
          userId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
          status: 'DELETED',
        },
      });

      // 3. Mark user INACTIVE and soft deleted
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          status: 'INACTIVE',
          refreshToken: null,
        },
      });

      return updatedUser;
    });
  }
}

export const usersRepository = new UsersRepository();

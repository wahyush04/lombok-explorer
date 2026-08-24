import { Prisma, User } from '@prisma/client';
import { prisma } from '../../database/prisma';

export class AuthRepository {
  public async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        deletedAt: null,
      },
    });
  }

  public async findById(id: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  public async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({
      data: {
        ...data,
        email: data.email.toLowerCase().trim(),
      },
    });
  }

  public async updateRefreshToken(userId: string, refreshToken: string | null): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });
  }

  public async clearRefreshToken(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }
}

export const authRepository = new AuthRepository();

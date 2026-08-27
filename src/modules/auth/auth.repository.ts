import { AuthIdentity, AuthProvider, Prisma, User } from '@prisma/client';
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

  public async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        username: username.toLowerCase().trim(),
        deletedAt: null,
      },
    });
  }

  public async findByEmailOrUsername(identifier: string): Promise<User | null> {
    const trimmed = identifier.trim().toLowerCase();
    return prisma.user.findFirst({
      where: {
        OR: [{ email: trimmed }, { username: trimmed }],
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
        username: data.username.toLowerCase().trim(),
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

  public async findIdentity(
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<(AuthIdentity & { user: User }) | null> {
    return prisma.authIdentity.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      include: {
        user: true,
      },
    });
  }

  public async createIdentity(
    userId: string,
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<AuthIdentity> {
    return prisma.authIdentity.create({
      data: {
        userId,
        provider,
        providerAccountId,
      },
    });
  }

  public async findIdentitiesByUserId(userId: string): Promise<AuthIdentity[]> {
    return prisma.authIdentity.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  public async deleteIdentity(userId: string, provider: AuthProvider): Promise<void> {
    await prisma.authIdentity.deleteMany({
      where: {
        userId,
        provider,
      },
    });
  }
}

export const authRepository = new AuthRepository();

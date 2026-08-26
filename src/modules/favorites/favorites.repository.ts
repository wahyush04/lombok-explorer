import { prisma } from '../../database/prisma';

export class FavoritesRepository {
  public async getUserFavorites(userId: string, page = 1, limit = 10) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          destination: {
            include: {
              category: true,
              images: {
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
      }),
      prisma.favorite.count({
        where: { userId },
      }),
    ]);

    return { items, total };
  }

  public async findFavorite(userId: string, destinationId: string) {
    return prisma.favorite.findUnique({
      where: {
        userId_destinationId: {
          userId,
          destinationId,
        },
      },
    });
  }

  public async addFavorite(userId: string, destinationId: string) {
    return prisma.favorite.create({
      data: {
        userId,
        destinationId,
      },
      include: {
        destination: {
          include: {
            category: true,
            images: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });
  }

  public async removeFavorite(userId: string, destinationId: string) {
    return prisma.favorite.delete({
      where: {
        userId_destinationId: {
          userId,
          destinationId,
        },
      },
    });
  }
}

export const favoritesRepository = new FavoritesRepository();

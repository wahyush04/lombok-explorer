import { FavoriteType, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';

export class FavoritesRepository {
  public async getUserFavorites(userId: string, page = 1, limit = 10) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.FavoriteWhereInput = {
      userId,
      type: FavoriteType.DESTINATION,
      destinationId: { not: null },
    };

    const [items, total] = await Promise.all([
      prisma.favorite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          destination: {
            include: {
              category: {
                include: { translations: true },
              },
              translations: true,
              images: {
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
      }),
      prisma.favorite.count({
        where,
      }),
    ]);

    return { items, total };
  }

  public async getUserUnifiedFavorites(
    userId: string,
    type?: string,
    page = 1,
    limit = 10,
  ) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.FavoriteWhereInput = {
      userId,
      ...(type && type !== 'ALL' ? { type: type as FavoriteType } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.favorite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          destination: {
            include: {
              category: {
                include: { translations: true },
              },
              translations: true,
              images: {
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
          accommodation: {
            include: {
              translations: true,
              images: {
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
          restaurant: {
            include: {
              translations: true,
              images: {
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
      }),
      prisma.favorite.count({
        where,
      }),
    ]);

    return { items, total };
  }

  // ==========================================
  // DESTINATION FAVORITES
  // ==========================================

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
        type: FavoriteType.DESTINATION,
      },
      include: {
        destination: {
          include: {
            category: {
              include: { translations: true },
            },
            translations: true,
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

  // ==========================================
  // ACCOMMODATION FAVORITES
  // ==========================================

  public async findAccommodationFavorite(userId: string, accommodationId: string) {
    return prisma.favorite.findUnique({
      where: {
        userId_accommodationId: {
          userId,
          accommodationId,
        },
      },
    });
  }

  public async addAccommodationFavorite(userId: string, accommodationId: string) {
    return prisma.favorite.create({
      data: {
        userId,
        accommodationId,
        type: FavoriteType.ACCOMMODATION,
      },
      include: {
        accommodation: {
          include: {
            translations: true,
            images: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });
  }

  public async removeAccommodationFavorite(userId: string, accommodationId: string) {
    return prisma.favorite.delete({
      where: {
        userId_accommodationId: {
          userId,
          accommodationId,
        },
      },
    });
  }

  // ==========================================
  // RESTAURANT FAVORITES
  // ==========================================

  public async findRestaurantFavorite(userId: string, restaurantId: string) {
    return prisma.favorite.findUnique({
      where: {
        userId_restaurantId: {
          userId,
          restaurantId,
        },
      },
    });
  }

  public async addRestaurantFavorite(userId: string, restaurantId: string) {
    return prisma.favorite.create({
      data: {
        userId,
        restaurantId,
        type: FavoriteType.RESTAURANT,
      },
      include: {
        restaurant: {
          include: {
            translations: true,
            images: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });
  }

  public async removeRestaurantFavorite(userId: string, restaurantId: string) {
    return prisma.favorite.delete({
      where: {
        userId_restaurantId: {
          userId,
          restaurantId,
        },
      },
    });
  }
}

export const favoritesRepository = new FavoritesRepository();

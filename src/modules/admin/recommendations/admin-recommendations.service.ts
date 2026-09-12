import { prisma } from '../../../database/prisma';
import { CreateAdminRecommendationDto, UpdateAdminRecommendationDto } from './dto/admin-recommendation.dto';
import { NotFoundError } from '../../../common/errors/app-error';

export class AdminRecommendationsService {
  public async getRecommendations() {
    return prisma.recommendation.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        destinations: {
          include: {
            destination: {
              select: { id: true, name: true, region: true, coverImageUrl: true, rating: true },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  public async getRecommendationById(id: string) {
    const item = await prisma.recommendation.findUnique({
      where: { id },
      include: {
        destinations: {
          include: {
            destination: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
    if (!item) throw new NotFoundError('Recommendation not found', 'NOT_FOUND');
    return item;
  }

  public async createRecommendation(dto: CreateAdminRecommendationDto) {
    const { destinationIds, ...rest } = dto;
    return prisma.recommendation.create({
      data: {
        ...rest,
        destinations: {
          create: (destinationIds || []).map((dstId, idx) => ({
            destinationId: dstId,
            orderIndex: idx,
          })),
        },
      },
      include: {
        destinations: { include: { destination: true } },
      },
    });
  }

  public async updateRecommendation(id: string, dto: UpdateAdminRecommendationDto) {
    const existing = await prisma.recommendation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Recommendation not found', 'NOT_FOUND');

    const { destinationIds, ...rest } = dto;

    if (destinationIds !== undefined) {
      await prisma.recommendationDestination.deleteMany({ where: { recommendationId: id } });
      if (destinationIds.length > 0) {
        await prisma.recommendationDestination.createMany({
          data: destinationIds.map((dstId, idx) => ({
            recommendationId: id,
            destinationId: dstId,
            orderIndex: idx,
          })),
        });
      }
    }

    return prisma.recommendation.update({
      where: { id },
      data: rest,
      include: {
        destinations: { include: { destination: true } },
      },
    });
  }

  public async deleteRecommendation(id: string) {
    const existing = await prisma.recommendation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Recommendation not found', 'NOT_FOUND');
    return prisma.recommendation.delete({ where: { id } });
  }
}

export const adminRecommendationsService = new AdminRecommendationsService();

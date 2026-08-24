import { Prisma, TravelJournal } from '@prisma/client';
import { prisma } from '../../database/prisma';

export interface JournalRepoFilters {
  userId?: string;
  search?: string;
  isPublic?: boolean;
  page?: number;
  limit?: number;
}

export class JournalsRepository {
  public async findMany(
    filters: JournalRepoFilters,
  ): Promise<{ items: TravelJournal[]; total: number }> {
    const where: Prisma.TravelJournalWhereInput = {
      deletedAt: null,
    };

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.isPublic !== undefined) {
      where.isPublic = filters.isPublic;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search } },
        { content: { contains: filters.search } },
        { locationName: { contains: filters.search } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.travelJournal.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.travelJournal.count({ where }),
    ]);

    return { items, total };
  }

  public async findById(id: string): Promise<TravelJournal | null> {
    return prisma.travelJournal.findFirst({
      where: { id, deletedAt: null },
    });
  }

  public async create(data: {
    userId: string;
    title: string;
    content: string;
    locationName?: string | null;
    date?: Date;
    photos?: string;
    isPublic?: boolean;
  }): Promise<TravelJournal> {
    return prisma.travelJournal.create({
      data: {
        userId: data.userId,
        title: data.title,
        content: data.content,
        locationName: data.locationName || null,
        date: data.date || new Date(),
        photos: data.photos || '[]',
        isPublic: data.isPublic || false,
      },
    });
  }

  public async update(
    id: string,
    data: {
      title?: string;
      content?: string;
      locationName?: string | null;
      date?: Date;
      photos?: string;
      isPublic?: boolean;
    },
  ): Promise<TravelJournal> {
    return prisma.travelJournal.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.locationName !== undefined && { locationName: data.locationName }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.photos !== undefined && { photos: data.photos }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      },
    });
  }

  public async softDelete(id: string): Promise<TravelJournal> {
    return prisma.travelJournal.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

export const journalsRepository = new JournalsRepository();

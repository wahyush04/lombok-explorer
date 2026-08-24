import { Category, Destination, Itinerary, ItineraryDay, ItineraryItem } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { itinerariesRepository, ItinerariesRepository } from './itineraries.repository';
import {
  CreateItineraryDto,
  ItineraryActivityDto,
  ItineraryDayDto,
  ItineraryDayInput,
  ItineraryDto,
  ItineraryQuery,
  UpdateItineraryDto,
} from './dto/itinerary.dto';
import { PaginationMeta } from '../../common/types';

export type ItineraryItemWithDestination = ItineraryItem & {
  destination?: (Destination & { category?: Category | null }) | null;
};

export type ItineraryDayWithItems = ItineraryDay & {
  items: ItineraryItemWithDestination[];
};

export type ItineraryWithRelations = Itinerary & {
  days: ItineraryDayWithItems[];
};

export class ItinerariesService {
  constructor(private readonly repository: ItinerariesRepository = itinerariesRepository) {}

  public mapToDto(itinerary: ItineraryWithRelations): ItineraryDto {
    const days: ItineraryDayDto[] = Array.isArray(itinerary.days)
      ? itinerary.days.map((day: ItineraryDayWithItems) => {
          const items: ItineraryActivityDto[] = Array.isArray(day.items)
            ? day.items.map((item: ItineraryItemWithDestination) => {
                let startTime: string | undefined;
                let endTime: string | undefined;

                if (item.timeSlot && item.timeSlot.includes('-')) {
                  const parts = item.timeSlot.split('-');
                  startTime = parts[0]?.trim();
                  endTime = parts[1]?.trim();
                }

                return {
                  id: item.id,
                  orderIndex: item.orderIndex,
                  timeSlot: item.timeSlot,
                  startTime,
                  endTime,
                  destinationId: item.destinationId,
                  destinationName: item.destination?.name || item.customTitle || 'Custom Activity',
                  destinationCategory: item.destination?.category?.name || 'Aktivitas Wisata',
                  imageUrl: item.destination?.coverImageUrl || undefined,
                  customTitle: item.customTitle,
                  activityNotes: item.activityNotes,
                  estimatedDurationMinutes: item.estimatedDurationMinutes,
                  estimatedCost: Number(item.estimatedCost) || 0,
                };
              })
            : [];

          return {
            id: day.id,
            dayNumber: day.dayNumber,
            title: day.title,
            date: day.date ? (new Date(day.date).toISOString().split('T')[0] ?? null) : null,
            notes: day.notes,
            activities: items,
          };
        })
      : [];

    return {
      id: itinerary.id,
      userId: itinerary.userId,
      title: itinerary.title,
      description: itinerary.description,
      coverImageUrl: itinerary.coverImageUrl,
      totalDays: itinerary.totalDays,
      totalEstimatedBudget: Number(itinerary.totalEstimatedBudget) || 0,
      travelStyle: itinerary.travelStyle,
      budgetLevel: itinerary.budgetLevel,
      pace: itinerary.pace,
      isPublic: itinerary.isPublic,
      isSaved: itinerary.isSaved,
      startDate: itinerary.startDate
        ? (new Date(itinerary.startDate).toISOString().split('T')[0] ?? null)
        : null,
      endDate: itinerary.endDate
        ? (new Date(itinerary.endDate).toISOString().split('T')[0] ?? null)
        : null,
      days,
      createdAt: itinerary.createdAt,
      updatedAt: itinerary.updatedAt,
    };
  }

  private calculateTotalBudget(days: ItineraryDayInput[]): number {
    let total = 0;
    for (const day of days) {
      const items = day.activities || day.items || [];
      for (const item of items) {
        total += Number(item.estimatedCost) || 0;
      }
    }
    return total;
  }

  public async getItineraries(
    query: ItineraryQuery,
    userId?: string,
  ): Promise<{ data: ItineraryDto[]; meta: PaginationMeta }> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const { items, total } = await this.repository.findMany({
      userId,
      isPublic: query.isPublic,
      travelStyle: query.travelStyle,
      budgetLevel: query.budgetLevel,
      search: query.search,
      page,
      limit,
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: items.map((item: ItineraryWithRelations) => this.mapToDto(item)),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  public async getItineraryById(
    id: string,
    userId?: string,
    userRole?: string,
  ): Promise<ItineraryDto> {
    const itinerary = await this.repository.findById(id);
    if (!itinerary) {
      throw new NotFoundError(`Itinerary '${id}' not found`, 'ITINERARY_NOT_FOUND');
    }

    // Access control for private itineraries
    if (!itinerary.isPublic && itinerary.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to view this private itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    return this.mapToDto(itinerary as ItineraryWithRelations);
  }

  public async createItinerary(userId: string, dto: CreateItineraryDto): Promise<ItineraryDto> {
    const totalDays = dto.days.length;
    const totalEstimatedBudget =
      dto.totalEstimatedBudget && Number(dto.totalEstimatedBudget) > 0
        ? Number(dto.totalEstimatedBudget)
        : this.calculateTotalBudget(dto.days);
    const startDate = dto.startDate ? new Date(dto.startDate) : null;
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    const created = await this.repository.createWithTransaction(
      {
        userId,
        title: dto.title,
        description: dto.description,
        coverImageUrl: dto.coverImageUrl,
        totalDays,
        totalEstimatedBudget,
        travelStyle: dto.travelStyle,
        budgetLevel: dto.budgetLevel,
        pace: dto.pace,
        isPublic: dto.isPublic,
        startDate,
        endDate,
      },
      dto.days,
    );

    return this.mapToDto(created as ItineraryWithRelations);
  }

  public async updateItinerary(
    userId: string,
    userRole: string,
    id: string,
    dto: UpdateItineraryDto,
  ): Promise<ItineraryDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Itinerary '${id}' not found`, 'ITINERARY_NOT_FOUND');
    }

    // Ownership check
    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to modify this itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    let totalDays: number | undefined;
    let totalEstimatedBudget: number | undefined;

    if (dto.days) {
      totalDays = dto.days.length;
      totalEstimatedBudget = this.calculateTotalBudget(dto.days);
    }

    const startDate =
      dto.startDate !== undefined ? (dto.startDate ? new Date(dto.startDate) : null) : undefined;
    const endDate =
      dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : undefined;

    const updated = await this.repository.updateWithTransaction(
      id,
      {
        title: dto.title,
        description: dto.description,
        coverImageUrl: dto.coverImageUrl,
        totalDays,
        totalEstimatedBudget,
        travelStyle: dto.travelStyle,
        budgetLevel: dto.budgetLevel,
        pace: dto.pace,
        isPublic: dto.isPublic,
        startDate,
        endDate,
      },
      dto.days,
    );

    return this.mapToDto(updated as ItineraryWithRelations);
  }

  public async deleteItinerary(userId: string, userRole: string, id: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Itinerary '${id}' not found`, 'ITINERARY_NOT_FOUND');
    }

    // Ownership check
    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to delete this itinerary',
        'FORBIDDEN_RESOURCE',
      );
    }

    await this.repository.delete(id);
  }
}

export const itinerariesService = new ItinerariesService();

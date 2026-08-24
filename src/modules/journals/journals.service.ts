import { TravelJournal } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { PaginationMeta } from '../../common/types';
import {
  CreateJournalDto,
  JournalQuery,
  TravelJournalDto,
  UpdateJournalDto,
} from './dto/journal.dto';
import { journalsRepository, JournalsRepository } from './journals.repository';

export class JournalsService {
  constructor(private readonly repository: JournalsRepository = journalsRepository) {}

  private parsePhotos(photosRaw: string | null): string[] {
    if (!photosRaw) return [];
    try {
      const parsed = JSON.parse(photosRaw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public mapToDto(journal: TravelJournal): TravelJournalDto {
    return {
      id: journal.id,
      userId: journal.userId,
      title: journal.title,
      content: journal.content,
      locationName: journal.locationName,
      date: journal.date ? (new Date(journal.date).toISOString().split('T')[0] ?? '') : '',
      photos: this.parsePhotos(journal.photos),
      isPublic: journal.isPublic,
      createdAt: journal.createdAt,
      updatedAt: journal.updatedAt,
    };
  }

  public async getJournals(
    query: JournalQuery,
    userId: string,
  ): Promise<{ data: TravelJournalDto[]; meta: PaginationMeta }> {
    const { items, total } = await this.repository.findMany({
      userId,
      search: query.search,
      isPublic: query.isPublic,
      page: query.page,
      limit: query.limit,
    });

    const totalPages = Math.ceil(total / query.limit) || 1;

    return {
      data: items.map((i) => this.mapToDto(i)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    };
  }

  public async getJournalById(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<TravelJournalDto> {
    const journal = await this.repository.findById(id);
    if (!journal) {
      throw new NotFoundError(`Travel journal '${id}' not found`, 'JOURNAL_NOT_FOUND');
    }

    if (journal.userId !== userId && userRole !== 'ADMIN' && !journal.isPublic) {
      throw new ForbiddenError(
        'You do not have permission to view this private journal entry',
        'FORBIDDEN_RESOURCE',
      );
    }

    return this.mapToDto(journal);
  }

  public async createJournal(userId: string, dto: CreateJournalDto): Promise<TravelJournalDto> {
    const created = await this.repository.create({
      userId,
      title: dto.title,
      content: dto.content,
      locationName: dto.locationName,
      date: dto.date ? new Date(dto.date) : new Date(),
      photos: dto.photos ? JSON.stringify(dto.photos) : '[]',
      isPublic: dto.isPublic,
    });

    return this.mapToDto(created);
  }

  public async updateJournal(
    id: string,
    userId: string,
    userRole: string,
    dto: UpdateJournalDto,
  ): Promise<TravelJournalDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Travel journal '${id}' not found`, 'JOURNAL_NOT_FOUND');
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to modify this journal entry',
        'FORBIDDEN_RESOURCE',
      );
    }

    const updated = await this.repository.update(id, {
      title: dto.title,
      content: dto.content,
      locationName: dto.locationName,
      date: dto.date ? new Date(dto.date) : undefined,
      photos: dto.photos ? JSON.stringify(dto.photos) : undefined,
      isPublic: dto.isPublic,
    });

    return this.mapToDto(updated);
  }

  public async deleteJournal(id: string, userId: string, userRole: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Travel journal '${id}' not found`, 'JOURNAL_NOT_FOUND');
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to delete this journal entry',
        'FORBIDDEN_RESOURCE',
      );
    }

    await this.repository.softDelete(id);
  }
}

export const journalsService = new JournalsService();

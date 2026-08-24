import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { PaginationMeta } from '../../common/types';
import {
  ChecklistDto,
  ChecklistQuery,
  CreateChecklistDto,
  UpdateChecklistDto,
} from './dto/checklist.dto';
import {
  checklistsRepository,
  ChecklistsRepository,
  ChecklistWithItems,
} from './checklists.repository';

export class ChecklistsService {
  constructor(private readonly repository: ChecklistsRepository = checklistsRepository) {}

  public mapToDto(checklist: ChecklistWithItems): ChecklistDto {
    const items = checklist.items || [];
    const totalItems = items.length;
    const completedItems = items.filter((i) => i.isChecked).length;
    const completionPercentage =
      totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    return {
      id: checklist.id,
      userId: checklist.userId,
      title: checklist.title,
      category: checklist.category,
      items: items.map((item) => ({
        id: item.id,
        checklistId: item.checklistId,
        itemText: item.itemText,
        isChecked: item.isChecked,
        orderIndex: item.orderIndex,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      totalItems,
      completedItems,
      completionPercentage,
      createdAt: checklist.createdAt,
      updatedAt: checklist.updatedAt,
    };
  }

  public async getChecklists(
    query: ChecklistQuery,
    userId: string,
  ): Promise<{ data: ChecklistDto[]; meta: PaginationMeta }> {
    const { items, total } = await this.repository.findMany({
      userId,
      category: query.category,
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

  public async getChecklistById(
    id: string,
    userId: string,
    userRole: string,
  ): Promise<ChecklistDto> {
    const checklist = await this.repository.findById(id);
    if (!checklist) {
      throw new NotFoundError(`Checklist '${id}' not found`, 'CHECKLIST_NOT_FOUND');
    }

    if (checklist.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to view this checklist',
        'FORBIDDEN_RESOURCE',
      );
    }

    return this.mapToDto(checklist);
  }

  public async createChecklist(userId: string, dto: CreateChecklistDto): Promise<ChecklistDto> {
    const created = await this.repository.createWithTransaction(
      {
        userId,
        title: dto.title,
        category: dto.category,
      },
      dto.items || [],
    );

    return this.mapToDto(created);
  }

  public async updateChecklist(
    id: string,
    userId: string,
    userRole: string,
    dto: UpdateChecklistDto,
  ): Promise<ChecklistDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Checklist '${id}' not found`, 'CHECKLIST_NOT_FOUND');
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to modify this checklist',
        'FORBIDDEN_RESOURCE',
      );
    }

    const updated = await this.repository.updateWithTransaction(
      id,
      {
        title: dto.title,
        category: dto.category,
      },
      dto.items,
    );

    return this.mapToDto(updated);
  }

  public async deleteChecklist(id: string, userId: string, userRole: string): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Checklist '${id}' not found`, 'CHECKLIST_NOT_FOUND');
    }

    if (existing.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError(
        'You do not have permission to delete this checklist',
        'FORBIDDEN_RESOURCE',
      );
    }

    await this.repository.delete(id);
  }
}

export const checklistsService = new ChecklistsService();

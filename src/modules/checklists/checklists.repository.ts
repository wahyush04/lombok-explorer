import { Checklist, ChecklistCategory, ChecklistItem, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { ChecklistItemInput } from './dto/checklist.dto';

export type ChecklistWithItems = Checklist & {
  items: ChecklistItem[];
};

export interface ChecklistRepoFilters {
  userId: string;
  category?: ChecklistCategory;
  page?: number;
  limit?: number;
}

export class ChecklistsRepository {
  public async findMany(
    filters: ChecklistRepoFilters,
  ): Promise<{ items: ChecklistWithItems[]; total: number }> {
    const where: Prisma.ChecklistWhereInput = {
      userId: filters.userId,
    };

    if (filters.category) {
      where.category = filters.category;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.checklist.findMany({
        where,
        include: {
          items: {
            orderBy: { orderIndex: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.checklist.count({ where }),
    ]);

    return { items, total };
  }

  public async findById(id: string): Promise<ChecklistWithItems | null> {
    return prisma.checklist.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }

  public async createWithTransaction(
    data: {
      userId: string;
      title: string;
      category: ChecklistCategory;
    },
    items: ChecklistItemInput[],
  ): Promise<ChecklistWithItems> {
    return prisma.$transaction(async (tx) => {
      const created = await tx.checklist.create({
        data: {
          userId: data.userId,
          title: data.title,
          category: data.category,
        },
      });

      if (items.length > 0) {
        await tx.checklistItem.createMany({
          data: items.map((item, index) => ({
            checklistId: created.id,
            itemText: item.itemText,
            isChecked: item.isChecked || false,
            orderIndex: item.orderIndex !== undefined ? item.orderIndex : index,
          })),
        });
      }

      const fullChecklist = await tx.checklist.findUnique({
        where: { id: created.id },
        include: {
          items: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      return fullChecklist!;
    });
  }

  public async updateWithTransaction(
    id: string,
    data: {
      title?: string;
      category?: ChecklistCategory;
    },
    items?: ChecklistItemInput[],
  ): Promise<ChecklistWithItems> {
    return prisma.$transaction(async (tx) => {
      // 1. Update checklist header
      await tx.checklist.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.category !== undefined && { category: data.category }),
        },
      });

      // 2. If items provided, replace items
      if (items !== undefined) {
        await tx.checklistItem.deleteMany({
          where: { checklistId: id },
        });

        if (items.length > 0) {
          await tx.checklistItem.createMany({
            data: items.map((item, index) => ({
              checklistId: id,
              itemText: item.itemText,
              isChecked: item.isChecked || false,
              orderIndex: item.orderIndex !== undefined ? item.orderIndex : index,
            })),
          });
        }
      }

      // 3. Return updated checklist with items
      const updated = await tx.checklist.findUnique({
        where: { id },
        include: {
          items: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      });

      return updated!;
    });
  }

  public async delete(id: string): Promise<Checklist> {
    return prisma.checklist.delete({
      where: { id },
    });
  }
}

export const checklistsRepository = new ChecklistsRepository();

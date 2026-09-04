import { prisma } from '../../../database/prisma';
import { AdminReportFilterQuery } from './dto/admin-feed.dto';

export class AdminFeedsRepository {
  public async findReports(query: AdminReportFilterQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.reason) {
      where.reason = query.reason;
    }

    if (query.search) {
      const search = query.search;
      where.OR = [
        { post: { title: { contains: search, mode: 'insensitive' } } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.postReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              avatarUrl: true,
            },
          },
          post: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  username: true,
                  avatarUrl: true,
                },
              },
              media: {
                orderBy: { sortOrder: 'asc' },
              },
              location: {
                include: { destination: true },
              },
            },
          },
        },
      }),
      prisma.postReport.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  public async findReportById(id: string) {
    return prisma.postReport.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            avatarUrl: true,
          },
        },
        post: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                username: true,
                avatarUrl: true,
              },
            },
            media: {
              orderBy: { sortOrder: 'asc' },
            },
            location: {
              include: { destination: true },
            },
          },
        },
      },
    });
  }

  public async updateReport(
    id: string,
    data: {
      status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
      adminNotes?: string | null;
      resolvedBy?: string | null;
    },
  ) {
    const isResolved = data.status === 'RESOLVED' || data.status === 'DISMISSED';

    return prisma.postReport.update({
      where: { id },
      data: {
        status: data.status as any,
        adminNotes: data.adminNotes !== undefined ? data.adminNotes : undefined,
        resolvedBy: data.resolvedBy !== undefined ? data.resolvedBy : undefined,
        resolvedAt: isResolved ? new Date() : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        post: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });
  }

  public async findPostById(postId: string) {
    return prisma.post.findUnique({
      where: { id: postId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });
  }

  public async updatePostStatus(
    postId: string,
    status: 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'DELETED',
  ) {
    const isDeleted = status === 'DELETED';

    return prisma.post.update({
      where: { id: postId },
      data: {
        status: status as any,
        deletedAt: isDeleted ? new Date() : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });
  }
}

export const adminFeedsRepository = new AdminFeedsRepository();

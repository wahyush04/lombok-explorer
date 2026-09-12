import { adminTripSessionsRepository, AdminTripSessionsRepository } from './admin-trip-sessions.repository';
import {
  AdminLiveMapPointDto,
  AdminTripSessionFilterQuery,
  AdminTripSessionListItemDto,
} from './dto/admin-trip-session.dto';
import { NotFoundError } from '../../../common/errors/app-error';

export class AdminTripSessionsService {
  constructor(private readonly repository: AdminTripSessionsRepository = adminTripSessionsRepository) {}

  public async getTripSessions(query: AdminTripSessionFilterQuery) {
    const { items, total } = await this.repository.findMany(query);
    const limit = query.limit || 10;
    const page = query.page || 1;

    const data: AdminTripSessionListItemDto[] = items.map((item) => {
      const totalActivitiesCount = item.activityProgress.length;
      const completedActivitiesCount = item.activityProgress.filter(
        (a) => a.status === 'COMPLETED',
      ).length;

      const totalDistanceMeters = item.routes.reduce((acc, r) => acc + (r.distanceMeters || 0), 0);
      const totalDurationSeconds = item.routes.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);

      return {
        id: item.id,
        userId: item.userId,
        userName: item.user.name,
        userEmail: item.user.email,
        userAvatarUrl: item.user.avatarUrl,
        itineraryId: item.itineraryId,
        itineraryTitle: item.itinerary.title,
        status: item.status,
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        pausedAt: item.pausedAt,
        totalDistanceMeters,
        totalDurationSeconds,
        lastLatitude: item.lastLatitude,
        lastLongitude: item.lastLongitude,
        lastLocationAt: item.lastLocationAt,
        totalActivitiesCount,
        completedActivitiesCount,
        createdAt: item.createdAt,
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  public async getTripSessionById(id: string) {
    const session = await this.repository.findById(id);
    if (!session) {
      throw new NotFoundError(`Trip session with ID '${id}' not found`, 'TRIP_SESSION_NOT_FOUND');
    }
    return session;
  }

  public async getLiveMapPoints(): Promise<AdminLiveMapPointDto[]> {
    const sessions = await this.repository.findActiveForMap();
    return sessions.map((s) => {
      const totalDistanceMeters = s.routes.reduce((acc, r) => acc + (r.distanceMeters || 0), 0);
      const totalDurationSeconds = s.routes.reduce((acc, r) => acc + (r.durationSeconds || 0), 0);

      return {
        id: s.id,
        userId: s.userId,
        userName: s.user.name,
        userAvatarUrl: s.user.avatarUrl,
        itineraryId: s.itineraryId,
        itineraryTitle: s.itinerary.title,
        status: s.status,
        latitude: s.lastLatitude!,
        longitude: s.lastLongitude!,
        lastLocationAt: s.lastLocationAt || new Date(),
        totalDistanceMeters,
        totalDurationSeconds,
      };
    });
  }
}

export const adminTripSessionsService = new AdminTripSessionsService();

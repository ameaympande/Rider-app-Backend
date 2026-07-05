import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { RidesService } from '../rides/rides.service';
import {
  RiderLocation,
  RiderLocationDocument,
} from '../schemas/location.schema';
import {
  LiveLocationSession,
  LiveLocationSessionDocument,
} from '../schemas/live-session.schema';
import { LocationHistoryQueryDto } from './dto/location-history-query.dto';
import { SaveLocationDto } from './dto/save-location.dto';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(
    @InjectModel(RiderLocation.name)
    private readonly locationModel: Model<RiderLocationDocument>,
    @InjectModel(LiveLocationSession.name)
    private readonly sessionModel: Model<LiveLocationSessionDocument>,
    private readonly ridesService: RidesService,
  ) {}

  // ──────────────────────────────────────────
  // SESSION MANAGEMENT
  // ──────────────────────────────────────────

  async startSession(userId: string, rideId: string) {
    await this.ridesService.assertMember(rideId, userId);

    // End any existing active sessions for this user in this room
    await this.sessionModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        roomId: new Types.ObjectId(rideId),
        isActive: true,
      },
      { isActive: false, endTime: new Date() },
    );

    return this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      roomId: new Types.ObjectId(rideId),
      startTime: new Date(),
      lastPingAt: new Date(),
      isActive: true,
    });
  }

  async endSession(userId: string, rideId: string) {
    return this.sessionModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        roomId: new Types.ObjectId(rideId),
        isActive: true,
      },
      { isActive: false, endTime: new Date() },
    );
  }

  /**
   * Idempotent: returns the existing active session or creates a new one.
   * Used to auto-restore sessions after reconnection.
   */
  async ensureSession(userId: string, rideId: string) {
    const existing = await this.sessionModel.findOne({
      userId: new Types.ObjectId(userId),
      roomId: new Types.ObjectId(rideId),
      isActive: true,
    });

    if (existing) {
      // Refresh the lastPingAt timestamp
      existing.lastPingAt = new Date();
      await existing.save();
      return { session: existing, wasCreated: false };
    }

    const session = await this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      roomId: new Types.ObjectId(rideId),
      startTime: new Date(),
      lastPingAt: new Date(),
      isActive: true,
    });

    return { session, wasCreated: true };
  }

  /**
   * Quick check if a user has an active session in a ride.
   */
  async isSessionActive(userId: string, rideId: string): Promise<boolean> {
    const count = await this.sessionModel.countDocuments({
      userId: new Types.ObjectId(userId),
      roomId: new Types.ObjectId(rideId),
      isActive: true,
    });
    return count > 0;
  }

  /**
   * Update the lastPingAt timestamp on the active session.
   */
  async touchSession(userId: string, rideId: string) {
    await this.sessionModel.updateOne(
      {
        userId: new Types.ObjectId(userId),
        roomId: new Types.ObjectId(rideId),
        isActive: true,
      },
      { lastPingAt: new Date() },
    );
  }

  // ──────────────────────────────────────────
  // LOCATION SAVING
  // ──────────────────────────────────────────

  /**
   * Saves a location update. Returns null if the update was a duplicate
   * or should be skipped (GPS jump, too-small movement).
   *
   * NOTE: Membership verification is NOT done here — it's the caller's
   * responsibility (the gateway verifies on joinRide).
   */
  async saveLocation(
    userId: string,
    dto: SaveLocationDto,
  ): Promise<RiderLocationDocument | null> {
    const skipReason = await this.shouldSkipLocation(userId, dto);

    if (skipReason) {
      this.logger.debug(
        `Skipping location for user ${userId}: ${skipReason}`,
      );
      return null;
    }

    const doc = await this.locationModel.create({
      ...dto,
      rideId: new Types.ObjectId(dto.rideId),
      userId: new Types.ObjectId(userId),
      status: dto.status ?? 'RIDING',
    });

    // Update session lastPingAt (fire and forget)
    this.touchSession(userId, dto.rideId).catch(() => {});

    return doc;
  }

  // ──────────────────────────────────────────
  // LIVE RIDERS QUERY
  // ──────────────────────────────────────────

  async getLiveRiders(rideId: string, userId: string) {
    await this.ridesService.assertMember(rideId, userId);

    const members = (await this.ridesService.getMembers(rideId)) as any[];
    const userIds = members.map((m) => m._id);

    // Fetch all active sessions in this ride room for these users
    const activeSessions = await this.sessionModel
      .find({
        roomId: new Types.ObjectId(rideId),
        userId: { $in: userIds },
        isActive: true,
      })
      .lean();

    const activeUserIdsSet = new Set(
      activeSessions.map((s) => s.userId.toString()),
    );

    // Fetch the latest location for each user in this ride
    const latestLocations = await this.locationModel.aggregate([
      {
        $match: {
          rideId: new Types.ObjectId(rideId),
          userId: { $in: userIds },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$userId',
          latest: { $first: '$$ROOT' },
        },
      },
    ]);

    const locationMap = new Map(
      latestLocations.map((item) => [item._id.toString(), item.latest]),
    );

    return members.map((member) => {
      const userIdStr = member._id.toString();
      const latestLoc = locationMap.get(userIdStr);
      return {
        user: {
          _id: member._id,
          name: member.name,
          phone: member.phone,
          avatar: member.avatar,
          bikeName: member.bikeName,
          isOnline: member.isOnline ?? false,
          lastActive: member.lastActive,
          emergencyContacts: member.emergencyContacts ?? [],
        },
        isSharing: activeUserIdsSet.has(userIdStr),
        location: latestLoc
          ? {
              lat: latestLoc.lat,
              lng: latestLoc.lng,
              accuracy: latestLoc.accuracy,
              speed: latestLoc.speed,
              heading: latestLoc.heading,
              battery: latestLoc.battery,
              status: latestLoc.status,
              createdAt: latestLoc.createdAt,
            }
          : null,
      };
    });
  }

  // ──────────────────────────────────────────
  // HISTORY QUERY
  // ──────────────────────────────────────────

  async getHistory(
    rideId: string,
    requesterId: string,
    query: LocationHistoryQueryDto,
  ) {
    await this.ridesService.assertMember(rideId, requesterId);

    const match: Record<string, unknown> = {
      rideId: new Types.ObjectId(rideId),
    };

    if (query.userId) {
      match.userId = new Types.ObjectId(query.userId);
    }

    if (query.startDate || query.endDate) {
      match.createdAt = {
        ...(query.startDate ? { $gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { $lte: new Date(query.endDate) } : {}),
      };
    }

    return this.locationModel.find(match).sort({ createdAt: 1 }).lean();
  }

  // ──────────────────────────────────────────
  // LATEST LOCATION
  // ──────────────────────────────────────────

  async getLatestLocation(userId: string, rideId: string) {
    return this.locationModel
      .findOne({
        userId: new Types.ObjectId(userId),
        rideId: new Types.ObjectId(rideId),
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  // ──────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────

  /**
   * Determines if a location update should be skipped.
   * Returns a reason string if it should be skipped, or null if it should be saved.
   *
   * Skips:
   * - Exact duplicate (same lat/lng/speed)
   * - Movement < 3 meters (noise)
   * - Impossible GPS jump (> 300 km/h)
   */
  private async shouldSkipLocation(
    userId: string,
    dto: SaveLocationDto,
  ): Promise<string | null> {
    const lastLocation = await this.locationModel
      .findOne({
        userId: new Types.ObjectId(userId),
        rideId: new Types.ObjectId(dto.rideId),
      })
      .sort({ createdAt: -1 })
      .lean();

    if (!lastLocation) {
      return null; // First location — always save
    }

    // Exact duplicate check
    if (
      lastLocation.lat === dto.lat &&
      lastLocation.lng === dto.lng &&
      lastLocation.speed === dto.speed
    ) {
      return 'duplicate';
    }

    const seconds =
      (Date.now() - new Date(lastLocation.createdAt).getTime()) / 1000;

    if (seconds <= 0) {
      return null; // Clock skew — allow it
    }

    const meters = this.distanceMeters(
      lastLocation.lat,
      lastLocation.lng,
      dto.lat,
      dto.lng,
    );

    // Skip if distance is < 3 meters (GPS noise)
    if (meters < 3) {
      return 'too-small-movement';
    }

    const kmh = (meters / seconds) * 3.6;

    // Silently skip impossible GPS jumps instead of throwing
    if (kmh > 300) {
      this.logger.warn(
        `GPS jump rejected for user ${userId}: ${Math.round(kmh)} km/h over ${Math.round(meters)}m in ${Math.round(seconds)}s`,
      );
      return 'gps-jump';
    }

    return null;
  }

  private distanceMeters(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
  ) {
    const radius = 6371000;
    const dLat = this.radians(toLat - fromLat);
    const dLng = this.radians(toLng - fromLng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.radians(fromLat)) *
        Math.cos(this.radians(toLat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private radians(value: number) {
    return (value * Math.PI) / 180;
  }
}

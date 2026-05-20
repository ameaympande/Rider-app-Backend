import { BadRequestException, Injectable } from '@nestjs/common';
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
  constructor(
    @InjectModel(RiderLocation.name)
    private readonly locationModel: Model<RiderLocationDocument>,
    @InjectModel(LiveLocationSession.name)
    private readonly sessionModel: Model<LiveLocationSessionDocument>,
    private readonly ridesService: RidesService,
  ) {}

  async startSession(userId: string, rideId: string) {
    await this.ridesService.assertMember(rideId, userId);
    
    // End any existing active sessions for this user in this room
    await this.sessionModel.updateMany(
      { userId: new Types.ObjectId(userId), roomId: new Types.ObjectId(rideId), isActive: true },
      { isActive: false, endTime: new Date() }
    );

    return this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      roomId: new Types.ObjectId(rideId),
      startTime: new Date(),
      isActive: true,
    });
  }

  async endSession(userId: string, rideId: string) {
    return this.sessionModel.updateMany(
      { userId: new Types.ObjectId(userId), roomId: new Types.ObjectId(rideId), isActive: true },
      { isActive: false, endTime: new Date() }
    );
  }

  async saveLocation(userId: string, dto: SaveLocationDto) {
    await this.ridesService.assertMember(dto.rideId, userId);
    const isBad = await this.rejectBadMovement(userId, dto);
    
    if (isBad === 'duplicate') {
      return {
        ...dto,
        rideId: new Types.ObjectId(dto.rideId),
        userId: new Types.ObjectId(userId),
        status: dto.status ?? 'RIDING',
        createdAt: new Date(),
      };
    }

    return this.locationModel.create({
      ...dto,
      rideId: new Types.ObjectId(dto.rideId),
      userId: new Types.ObjectId(userId),
      status: dto.status ?? 'RIDING',
    });
  }

  async getLiveRiders(rideId: string, userId: string) {
    await this.ridesService.assertMember(rideId, userId);

    return this.locationModel.aggregate([
      {
        $match: {
          rideId: new Types.ObjectId(rideId),
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$userId',
          latest: { $first: '$$ROOT' },
        },
      },
      { $replaceRoot: { newRoot: '$latest' } },
    ]);
  }

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

  private async rejectBadMovement(userId: string, dto: SaveLocationDto) {
    const lastLocation = await this.locationModel
      .findOne({
        userId: new Types.ObjectId(userId),
        rideId: new Types.ObjectId(dto.rideId),
      })
      .sort({ createdAt: -1 })
      .lean();

    if (!lastLocation) {
      return;
    }

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
      return false;
    }

    const meters = this.distanceMeters(
      lastLocation.lat,
      lastLocation.lng,
      dto.lat,
      dto.lng,
    );

    // Optimization: skip write if distance is < 5 meters
    if (meters < 5) {
      return 'duplicate';
    }

    const kmh = (meters / seconds) * 3.6;

    if (kmh > 300) {
      throw new BadRequestException('Impossible GPS jump rejected');
    }

    return false;
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

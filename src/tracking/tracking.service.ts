import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { RidesService } from '../rides/rides.service';
import {
  RiderLocation,
  RiderLocationDocument,
} from '../schemas/location.schema';
import { LocationHistoryQueryDto } from './dto/location-history-query.dto';
import { SaveLocationDto } from './dto/save-location.dto';

@Injectable()
export class TrackingService {
  constructor(
    @InjectModel(RiderLocation.name)
    private readonly locationModel: Model<RiderLocationDocument>,
    private readonly ridesService: RidesService,
  ) {}

  async saveLocation(userId: string, dto: SaveLocationDto) {
    await this.ridesService.assertMember(dto.rideId, userId);
    await this.rejectBadMovement(userId, dto);

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
      throw new BadRequestException('Duplicate location update');
    }

    const seconds =
      (Date.now() - new Date(lastLocation.createdAt).getTime()) / 1000;

    if (seconds <= 0) {
      return;
    }

    const meters = this.distanceMeters(
      lastLocation.lat,
      lastLocation.lng,
      dto.lat,
      dto.lng,
    );
    const kmh = (meters / seconds) * 3.6;

    if (kmh > 300) {
      throw new BadRequestException('Impossible GPS jump rejected');
    }
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

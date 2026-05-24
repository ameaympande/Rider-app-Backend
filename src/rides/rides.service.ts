import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';

import { RideRoom, RideRoomDocument } from '../schemas/ride-room.schema';
import { RideHistory, RideHistoryDocument } from '../schemas/ride-history.schema';
import { CreateRideDto } from './dto/create-ride.dto';
import { JoinRideDto } from './dto/join-ride.dto';

import { rideEvents$ } from '../common/events/ride-events';

@Injectable()
export class RidesService {
  constructor(
    @InjectModel(RideRoom.name)
    private readonly rideModel: Model<RideRoomDocument>,
    @InjectModel(RideHistory.name)
    private readonly historyModel: Model<RideHistoryDocument>,
  ) {}

  async create(adminId: string, dto: CreateRideDto) {
    const adminObjectId = this.toObjectId(adminId, 'Invalid admin ID');
    return this.rideModel.create({
      ...dto,
      adminId: adminObjectId,
      inviteCode: this.createInviteCode(),
      members: [adminObjectId],
    });
  }

  async findByIdOrThrow(rideId: string) {
    const ride = await this.rideModel
      .findById(this.toObjectId(rideId, 'Invalid ride ID'))
      .lean();

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    return ride;
  }

  async findByInviteCode(inviteCode: string) {
    const ride = await this.rideModel
      .findOne({ inviteCode: inviteCode.toUpperCase() })
      .lean();

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    return ride;
  }

  async join(rideId: string, userId: string, dto: JoinRideDto) {
    const ride = await this.rideModel.findById(
      this.toObjectId(rideId, 'Invalid ride ID'),
    );

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.isPrivate && ride.inviteCode !== dto.inviteCode) {
      throw new ForbiddenException('Invalid invite code');
    }

    const userObjectId = this.toObjectId(userId, 'Invalid user ID');

    if (
      ride.members.some(
        (member) => member.toString() === userObjectId.toString(),
      )
    ) {
      return ride;
    }

    ride.members.push(userObjectId);
    return ride.save();
  }

  async leave(rideId: string, userId: string) {
    const ride = await this.rideModel.findById(
      this.toObjectId(rideId, 'Invalid ride ID'),
    );

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.adminId.toString() === userId) {
      // Archive the ride convoy before deleting it
      await this.historyModel.create({
        name: ride.name,
        destination: ride.destination,
        destinationLat: (ride as any).destinationLat,
        destinationLng: (ride as any).destinationLng,
        adminId: ride.adminId,
        isPrivate: ride.isPrivate,
        inviteCode: ride.inviteCode,
        members: ride.members,
        createdAt: ride.createdAt,
      });

      await this.rideModel.deleteOne({ _id: ride._id });
      rideEvents$.next({ type: 'RIDE_ENDED', rideId: ride._id.toString() });
      return null;
    }

    ride.members = ride.members.filter(
      (member) => member.toString() !== userId,
    );

    return ride.save();
  }

  async getRideHistory(userId: string) {
    const userObjectId = this.toObjectId(userId, 'Invalid user ID');
    return this.historyModel
      .find({ members: userObjectId })
      .sort({ createdAt: -1 })
      .lean();
  }

  async countFinishedRidesForUser(userId: string): Promise<number> {
    if (!Types.ObjectId.isValid(userId)) return 0;
    return this.historyModel.countDocuments({
      members: new Types.ObjectId(userId),
    });
  }

  async countActiveRidesForUser(userId: string): Promise<number> {
    if (!Types.ObjectId.isValid(userId)) return 0;
    return this.rideModel.countDocuments({
      members: new Types.ObjectId(userId),
    });
  }

  async getMembers(rideId: string) {
    const ride = await this.rideModel
      .findById(this.toObjectId(rideId, 'Invalid ride ID'))
      .populate('members')
      .lean();

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    return ride.members;
  }

  async removeMember(rideId: string, adminId: string, userId: string) {
    const ride = await this.rideModel.findById(
      this.toObjectId(rideId, 'Invalid ride ID'),
    );

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.adminId.toString() !== adminId) {
      throw new ForbiddenException('Only the ride admin can remove riders');
    }

    if (adminId === userId) {
      throw new BadRequestException('Admin cannot remove themselves');
    }

    ride.members = ride.members.filter(
      (member) => member.toString() !== userId,
    );

    return ride.save();
  }

  async assertMember(rideId: string, userId: string) {
    const ride = await this.findByIdOrThrow(rideId);

    if (!ride.members.some((member) => member.toString() === userId)) {
      throw new ForbiddenException('User is not a ride member');
    }

    return ride;
  }

  async update(rideId: string, userId: string, dto: { destination?: string; destinationLat?: number; destinationLng?: number }) {
    const ride = await this.rideModel.findById(this.toObjectId(rideId, 'Invalid ride ID'));
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (!ride.members.some((member) => member.toString() === userId)) {
      throw new ForbiddenException('User is not a ride member');
    }

    if (dto.destination !== undefined) {
      ride.destination = dto.destination;
    }
    if (dto.destinationLat !== undefined) {
      (ride as any).destinationLat = dto.destinationLat;
    }
    if (dto.destinationLng !== undefined) {
      (ride as any).destinationLng = dto.destinationLng;
    }

    return ride.save();
  }

  private toObjectId(value: string, message: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(message);
    }

    return new Types.ObjectId(value);
  }

  private createInviteCode() {
    return randomBytes(4).toString('hex').toUpperCase();
  }
}

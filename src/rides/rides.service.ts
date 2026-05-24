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
import { CreateRideDto } from './dto/create-ride.dto';
import { JoinRideDto } from './dto/join-ride.dto';

import { rideEvents$ } from '../common/events/ride-events';

@Injectable()
export class RidesService {
  constructor(
    @InjectModel(RideRoom.name)
    private readonly rideModel: Model<RideRoomDocument>,
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
      await this.rideModel.deleteOne({ _id: ride._id });
      rideEvents$.next({ type: 'RIDE_ENDED', rideId: ride._id.toString() });
      return null;
    }

    ride.members = ride.members.filter(
      (member) => member.toString() !== userId,
    );

    return ride.save();
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

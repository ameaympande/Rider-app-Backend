import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

import { User, UserDocument } from '../schemas/user.schema';
import { Bike, BikeDocument } from '../schemas/bike.schema';
import { RideRoom, RideRoomDocument } from '../schemas/ride-room.schema';
import { RideHistory, RideHistoryDocument } from '../schemas/ride-history.schema';
import { AddEmergencyContactDto } from './dto/add-emergency-contact.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateBikeDto } from './dto/create-bike.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Bike.name)
    private bikeModel: Model<BikeDocument>,
    @InjectModel(RideRoom.name)
    private rideModel: Model<RideRoomDocument>,
    @InjectModel(RideHistory.name)
    private historyModel: Model<RideHistoryDocument>,
  ) {}

  async create(data: Partial<CreateUserDto>) {
    const existing = await this.findByPhone(data.phone ?? '');

    if (existing) {
      return existing;
    }

    return this.userModel.create(data);
  }

  async findByPhone(phone: string) {
    return this.userModel.findOne({
      phone,
    });
  }

  async findById(userId: string) {
    return this.userModel.findById(userId);
  }

  async findByIdOrThrow(userId: string) {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userObj = user.toObject() as any;

    // Calculate stats
    const userObjectId = new Types.ObjectId(userId);
    const activeRidesCount = await this.rideModel.countDocuments({
      members: userObjectId,
    });
    const finishedRidesCount = await this.historyModel.countDocuments({
      members: userObjectId,
    });
    const ridesCount = activeRidesCount + finishedRidesCount;

    const bikes = await this.bikeModel.find({ userId: userObjectId }).lean();
    let totalDistanceKm = bikes.reduce(
      (sum, bike) => sum + (bike.odometer ?? 0),
      0,
    );
    if (totalDistanceKm === 0 && ridesCount > 0) {
      totalDistanceKm = ridesCount * 45.3;
    }

    userObj.stats = {
      ridesCount,
      totalDistanceKm: parseFloat(totalDistanceKm.toFixed(1)),
      averageRating: 4.9,
    };

    return userObj;
  }

  async updateProfile(userId: string, data: UpdateUserDto) {
    const user = await this.userModel.findByIdAndUpdate(userId, data, {
      new: true,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.findByIdOrThrow(userId);
  }

  async addEmergencyContact(userId: string, contact: AddEmergencyContactDto) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $addToSet: {
          emergencyContacts: contact,
        },
      },
      { new: true },
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.findByIdOrThrow(userId);
  }

  async updatePresence(userId: string, isOnline: boolean) {
    return this.userModel.findByIdAndUpdate(
      userId,
      {
        isOnline,
        lastActive: new Date(),
      },
      { new: true }
    );
  }

  async findBikes(userId: string) {
    const bikes = await this.bikeModel
      .find({ userId: new Types.ObjectId(userId) })
      .lean();
    return bikes.map((bike) => ({
      _id: bike._id,
      name: bike.name,
      model: bike.brand,
      year: bike.year,
      odometer: bike.odometer,
    }));
  }

  async addBike(userId: string, dto: CreateBikeDto) {
    const bike = await this.bikeModel.create({
      name: dto.name,
      brand: dto.model,
      year: dto.year,
      odometer: dto.odometer,
      userId: new Types.ObjectId(userId),
    });
    const bikeObj = bike.toObject();
    return {
      _id: bikeObj._id,
      name: bikeObj.name,
      model: bikeObj.brand,
      year: bikeObj.year,
      odometer: bikeObj.odometer,
    };
  }

  async deleteBike(userId: string, bikeId: string) {
    if (!Types.ObjectId.isValid(bikeId)) {
      throw new ConflictException('Invalid bike ID');
    }
    const result = await this.bikeModel.deleteOne({
      _id: new Types.ObjectId(bikeId),
      userId: new Types.ObjectId(userId),
    });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Bike not found in garage');
    }
    return { success: true };
  }
}

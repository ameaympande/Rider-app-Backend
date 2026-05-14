import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';

import { Model } from 'mongoose';

import { User, UserDocument } from '../schemas/user.schema';
import { AddEmergencyContactDto } from './dto/add-emergency-contact.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async create(data: Partial<CreateUserDto>) {
    const existing = await this.findByPhone(data.phone ?? '');

    if (existing) {
      throw new ConflictException('Phone already registered');
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
    const user = await this.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, data: UpdateUserDto) {
    const user = await this.userModel.findByIdAndUpdate(userId, data, {
      new: true,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
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

    return user;
  }
}

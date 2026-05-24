import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../schemas/user.schema';
import { Bike, BikeSchema } from '../schemas/bike.schema';
import { RideRoom, RideRoomSchema } from '../schemas/ride-room.schema';
import { RideHistory, RideHistorySchema } from '../schemas/ride-history.schema';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: User.name,
        schema: UserSchema,
      },
      {
        name: Bike.name,
        schema: BikeSchema,
      },
      {
        name: RideRoom.name,
        schema: RideRoomSchema,
      },
      {
        name: RideHistory.name,
        schema: RideHistorySchema,
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}

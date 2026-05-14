import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RideRoom, RideRoomSchema } from '../schemas/ride-room.schema';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: RideRoom.name,
        schema: RideRoomSchema,
      },
    ]),
  ],
  controllers: [RidesController],
  providers: [RidesService],
  exports: [RidesService],
})
export class RidesModule {}

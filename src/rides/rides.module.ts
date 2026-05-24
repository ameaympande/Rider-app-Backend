import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RideRoom, RideRoomSchema } from '../schemas/ride-room.schema';
import { RideHistory, RideHistorySchema } from '../schemas/ride-history.schema';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';

@Module({
  imports: [
    MongooseModule.forFeature([
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
  controllers: [RidesController],
  providers: [RidesService],
  exports: [RidesService, MongooseModule],
})
export class RidesModule {}

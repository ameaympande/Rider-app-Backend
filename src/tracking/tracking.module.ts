import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { RidesModule } from '../rides/rides.module';
import { RiderLocation, RiderLocationSchema } from '../schemas/location.schema';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({
  imports: [
    RidesModule,
    MongooseModule.forFeature([
      {
        name: RiderLocation.name,
        schema: RiderLocationSchema,
      },
    ]),
  ],
  controllers: [TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}

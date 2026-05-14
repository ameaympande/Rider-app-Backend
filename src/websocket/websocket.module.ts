import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RidesModule } from '../rides/rides.module';
import { TrackingModule } from '../tracking/tracking.module';
import { LocationGateway } from './location/location.gateway';

@Module({
  imports: [AuthModule, RidesModule, TrackingModule],
  providers: [LocationGateway],
})
export class WebsocketModule {}

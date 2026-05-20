import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RidesModule } from '../rides/rides.module';
import { TrackingModule } from '../tracking/tracking.module';
import { UsersModule } from '../users/users.module';
import { LocationGateway } from './location/location.gateway';

@Module({
  imports: [AuthModule, RidesModule, TrackingModule, UsersModule],
  providers: [LocationGateway],
})
export class WebsocketModule {}

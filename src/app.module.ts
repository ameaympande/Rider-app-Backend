import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from './users/users.module';
import { WebsocketModule } from './websocket/websocket.module';
import { AuthModule } from './auth/auth.module';
import { RidesModule } from './rides/rides.module';
import { TrackingModule } from './tracking/tracking.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    MongooseModule.forRoot(process.env.MONGO_URI as string),

    AuthModule,
    UsersModule,
    RidesModule,
    TrackingModule,
    WebsocketModule,
  ],
})
export class AppModule {}

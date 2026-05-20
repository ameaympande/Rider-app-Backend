import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Server, Socket } from 'socket.io';

import { AuthService } from '../../auth/auth.service';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { RidesService } from '../../rides/rides.service';
import { SaveLocationDto } from '../../tracking/dto/save-location.dto';
import { TrackingService } from '../../tracking/tracking.service';
import { UsersService } from '../../users/users.service';

type SocketState = {
  user: RequestUser;
  rideIds: Set<string>;
};

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
  },
})
export class LocationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly socketStates = new Map<string, SocketState>();

  constructor(
    private readonly authService: AuthService,
    private readonly ridesService: RidesService,
    private readonly trackingService: TrackingService,
    private readonly usersService: UsersService,
  ) {}

  // ======================================
  // USER CONNECTED
  // ======================================

  handleConnection(client: Socket) {
    const authToken =
      typeof client.handshake.auth.token === 'string'
        ? client.handshake.auth.token
        : undefined;
    const headerToken =
      typeof client.handshake.headers.authorization === 'string'
        ? client.handshake.headers.authorization.replace('Bearer ', '')
        : undefined;
    const token = authToken ?? headerToken;

    if (!token || typeof token !== 'string') {
      client.disconnect(true);
      return;
    }

    try {
      const user = this.authService.verifyAccessToken(token);
      this.socketStates.set(client.id, {
        user,
        rideIds: new Set<string>(),
      });

      // Update presence asynchronously
      this.usersService.updatePresence(user.userId, true).catch(() => {});
    } catch {
      client.disconnect(true);
    }
  }

  // ======================================
  // USER DISCONNECTED
  // ======================================

  handleDisconnect(client: Socket) {
    const state = this.socketStates.get(client.id);

    if (!state) {
      return;
    }

    for (const rideId of state.rideIds) {
      this.server.to(rideId).emit('riderLeft', {
        userId: state.user.userId,
      });
      // Emit the requested user_left alias
      this.server.to(rideId).emit('user_left', {
        userId: state.user.userId,
      });
      // Also emit user_offline
      this.server.to(rideId).emit('user_offline', {
        userId: state.user.userId,
      });
      
      this.trackingService.endSession(state.user.userId, rideId).catch(() => {});
    }

    this.usersService.updatePresence(state.user.userId, false).catch(() => {});

    this.socketStates.delete(client.id);
  }

  // ======================================
  // JOIN RIDE ROOM
  // ======================================

  @SubscribeMessage('joinRide')
  async handleJoinRide(
    @MessageBody()
    data: {
      rideId: string;
    },

    @ConnectedSocket()
    client: Socket,
  ) {
    const state = this.getSocketState(client);

    try {
      await this.ridesService.assertMember(data.rideId, state.user.userId);
      await client.join(data.rideId);
      state.rideIds.add(data.rideId);

      this.server.to(data.rideId).emit('riderJoined', {
        userId: state.user.userId,
      });
      this.server.to(data.rideId).emit('user_joined', {
        userId: state.user.userId,
      });
    } catch (error) {
      this.emitError(client, error);
    }
  }

  @SubscribeMessage('leaveRide')
  async handleLeaveRide(
    @MessageBody()
    data: {
      rideId: string;
    },
    @ConnectedSocket()
    client: Socket,
  ) {
    const state = this.getSocketState(client);

    await client.leave(data.rideId);
    state.rideIds.delete(data.rideId);

    this.server.to(data.rideId).emit('riderLeft', {
      userId: state.user.userId,
    });
    this.server.to(data.rideId).emit('user_left', {
      userId: state.user.userId,
    });
  }

  // ======================================
  // LIVE LOCATION UPDATE & SHARING
  // ======================================

  @SubscribeMessage('startSharing')
  async handleStartSharing(
    @MessageBody() data: { rideId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const state = this.getSocketState(client);
    try {
      await this.trackingService.startSession(state.user.userId, data.rideId);
      this.server.to(data.rideId).emit('sharing_started', {
        rideId: data.rideId,
        userId: state.user.userId,
      });
    } catch (error) {
      this.emitError(client, error);
    }
  }

  @SubscribeMessage('stopSharing')
  async handleStopSharing(
    @MessageBody() data: { rideId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const state = this.getSocketState(client);
    try {
      await this.trackingService.endSession(state.user.userId, data.rideId);
      this.server.to(data.rideId).emit('sharing_stopped', {
        rideId: data.rideId,
        userId: state.user.userId,
      });
    } catch (error) {
      this.emitError(client, error);
    }
  }

  @SubscribeMessage('locationUpdate')
  async handleLocationUpdate(
    @MessageBody()
    data: {
      rideId: string;
      lat: number;
      lng: number;
      speed?: number;
      heading?: number;
      battery?: number;
      status?: string;
    },
    @ConnectedSocket()
    client: Socket,
  ) {
    const state = this.getSocketState(client);

    try {
      const dto = await this.validateLocationPayload(data);
      const savedLocation = await this.trackingService.saveLocation(
        state.user.userId,
        dto,
      );

      if (!savedLocation) return; // Skip duplicate

      this.server.to(dto.rideId).emit('riderLocation', {
        rideId: dto.rideId,
        userId: state.user.userId,
        lat: savedLocation.lat,
        lng: savedLocation.lng,
        accuracy: savedLocation.accuracy,
        speed: savedLocation.speed,
        heading: savedLocation.heading,
        battery: savedLocation.battery,
        status: savedLocation.status,
        createdAt: savedLocation.createdAt,
      });
      // Emit the requested location_update alias
      this.server.to(dto.rideId).emit('location_update', {
        rideId: dto.rideId,
        userId: state.user.userId,
        lat: savedLocation.lat,
        lng: savedLocation.lng,
        accuracy: savedLocation.accuracy,
        speed: savedLocation.speed,
        heading: savedLocation.heading,
        battery: savedLocation.battery,
        status: savedLocation.status,
        createdAt: savedLocation.createdAt,
      });
    } catch (error) {
      this.emitError(client, error);
    }
  }

  @SubscribeMessage('speedUpdate')
  handleSpeedUpdate(
    @MessageBody()
    data: { rideId: string; speed: number },
    @ConnectedSocket()
    client: Socket,
  ) {
    const state = this.getSocketState(client);

    this.server.to(data.rideId).emit('riderSpeed', {
      rideId: data.rideId,
      userId: state.user.userId,
      speed: data.speed,
    });
  }

  @SubscribeMessage('riderStatus')
  handleRiderStatus(
    @MessageBody()
    data: { rideId: string; status: string },
    @ConnectedSocket()
    client: Socket,
  ) {
    const state = this.getSocketState(client);

    this.server.to(data.rideId).emit('rideUpdated', {
      rideId: data.rideId,
      userId: state.user.userId,
      status: data.status,
    });
  }

  @SubscribeMessage('emergencySOS')
  handleEmergencySos(
    @MessageBody()
    data: { rideId: string; message?: string },
    @ConnectedSocket()
    client: Socket,
  ) {
    const state = this.getSocketState(client);

    this.server.to(data.rideId).emit('emergencyAlert', {
      rideId: data.rideId,
      userId: state.user.userId,
      message: data.message ?? 'SOS triggered',
    });
  }

  private getSocketState(client: Socket) {
    const state = this.socketStates.get(client.id);

    if (!state) {
      client.disconnect(true);
      throw new Error('Socket is not authenticated');
    }

    return state;
  }

  private async validateLocationPayload(data: object) {
    const dto = plainToInstance(SaveLocationDto, data, {
      enableImplicitConversion: true,
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      throw new Error('Invalid location payload');
    }

    return dto;
  }

  private emitError(client: Socket, error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Socket operation failed';

    client.emit('error', {
      message,
    });
  }
}

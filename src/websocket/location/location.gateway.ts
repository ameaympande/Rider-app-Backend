import { Logger, OnModuleInit } from '@nestjs/common';
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
import { rideEvents$ } from '../../common/events/ride-events';

type SocketState = {
  user: RequestUser;
  rideIds: Set<string>;
  /** Cache of verified ride memberships to avoid redundant DB queries */
  verifiedRides: Set<string>;
  /** Whether this socket was sharing location before (for reconnect detection) */
  wasSharing: boolean;
};

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? '*',
  },
  // Better mobile connection resilience
  pingTimeout: 30000, // 30s before considering disconnected
  pingInterval: 10000, // Ping every 10s
  transports: ['websocket', 'polling'], // Fallback to polling on bad networks
  connectTimeout: 15000, // 15s connection timeout
})
export class LocationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationGateway.name);
  private readonly socketStates = new Map<string, SocketState>();

  constructor(
    private readonly authService: AuthService,
    private readonly ridesService: RidesService,
    private readonly trackingService: TrackingService,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit() {
    rideEvents$.subscribe((event) => {
      if (event.type === 'RIDE_ENDED') {
        this.server.to(event.rideId).emit('rideEnded', { rideId: event.rideId });
      }
    });
  }

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
        verifiedRides: new Set<string>(),
        wasSharing: false,
      });

      // Update presence asynchronously
      this.usersService.updatePresence(user.userId, true).catch(() => {});

      this.logger.log(`User ${user.userId} connected (socket ${client.id})`);
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

    this.logger.log(`User ${state.user.userId} disconnected (socket ${client.id})`);

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

      this.trackingService
        .endSession(state.user.userId, rideId)
        .catch(() => {});
    }

    this.usersService
      .updatePresence(state.user.userId, false)
      .catch(() => {});

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
      // Cache the membership verification
      state.verifiedRides.add(data.rideId);

      this.server.to(data.rideId).emit('riderJoined', {
        userId: state.user.userId,
      });
      this.server.to(data.rideId).emit('user_joined', {
        userId: state.user.userId,
      });

      // Send the initial list of live riders and their locations directly to the joining user
      const liveRiders = await this.trackingService.getLiveRiders(
        data.rideId,
        state.user.userId,
      );
      client.emit('liveRiders', liveRiders);

      // Check if this user had an active session (reconnection scenario)
      const wasActive = await this.trackingService.isSessionActive(
        state.user.userId,
        data.rideId,
      );

      if (wasActive) {
        // Notify the client that they have an active session that can be resumed
        client.emit('session_restored', {
          rideId: data.rideId,
          userId: state.user.userId,
          message: 'Your sharing session is still active',
        });
        state.wasSharing = true;
      } else {
        // Notify if a previous session was lost (so the client can re-start sharing)
        client.emit('session_lost', {
          rideId: data.rideId,
          userId: state.user.userId,
          message: 'Your previous sharing session has ended. Re-start sharing to resume.',
        });
      }

      this.logger.log(
        `User ${state.user.userId} joined ride ${data.rideId} (active session: ${wasActive})`,
      );
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
    state.verifiedRides.delete(data.rideId);

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
      state.wasSharing = true;
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
      state.wasSharing = false;
      this.server.to(data.rideId).emit('sharing_stopped', {
        rideId: data.rideId,
        userId: state.user.userId,
      });
    } catch (error) {
      this.emitError(client, error);
    }
  }

  /**
   * Handler for the 'locationUpdate' event (camelCase — used by the frontend guide).
   */
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
    return this.processLocationUpdate(data, client);
  }

  /**
   * Handler for the 'location_update' event (snake_case — alias for compatibility).
   */
  @SubscribeMessage('location_update')
  async handleLocationUpdateSnake(
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
    return this.processLocationUpdate(data, client);
  }

  /**
   * Shared logic for processing location updates from either event name.
   */
  private async processLocationUpdate(
    data: {
      rideId: string;
      lat: number;
      lng: number;
      speed?: number;
      heading?: number;
      battery?: number;
      status?: string;
    },
    client: Socket,
  ) {
    const state = this.getSocketState(client);

    try {
      // Verify ride membership from cache (no DB hit after joinRide)
      if (!state.verifiedRides.has(data.rideId)) {
        await this.ridesService.assertMember(data.rideId, state.user.userId);
        state.verifiedRides.add(data.rideId);
      }

      const dto = await this.validateLocationPayload(data);

      // Auto-ensure session: if the user is sending location updates but
      // doesn't have an active session (e.g., reconnected after disconnect),
      // auto-create one and notify other riders.
      const { wasCreated } = await this.trackingService.ensureSession(
        state.user.userId,
        dto.rideId,
      );

      if (wasCreated) {
        this.logger.log(
          `Auto-restored sharing session for user ${state.user.userId} in ride ${dto.rideId}`,
        );
        this.server.to(dto.rideId).emit('sharing_started', {
          rideId: dto.rideId,
          userId: state.user.userId,
        });
        state.wasSharing = true;
      }

      const savedLocation = await this.trackingService.saveLocation(
        state.user.userId,
        dto,
      );

      if (!savedLocation) return; // Skip duplicate / GPS noise / GPS jump

      // Broadcast to all riders in the room
      const locationPayload = {
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
      };

      this.server.to(dto.rideId).emit('riderLocation', locationPayload);
      this.server.to(dto.rideId).emit('location_update', locationPayload);

      // Emit the location_broadcast event from the specification contract
      this.server.to(dto.rideId).emit('location_broadcast', {
        userId: state.user.userId,
        lat: savedLocation.lat,
        lng: savedLocation.lng,
        speed: savedLocation.speed,
        heading: savedLocation.heading,
        battery: savedLocation.battery,
        status: savedLocation.status,
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

  @SubscribeMessage('destinationUpdate')
  handleDestinationUpdate(
    @MessageBody()
    data: { rideId: string; destination: string; lat?: number; lng?: number },
    @ConnectedSocket()
    client: Socket,
  ) {
    this.server.to(data.rideId).emit('destinationUpdate', {
      rideId: data.rideId,
      destination: data.destination,
      lat: data.lat,
      lng: data.lng,
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

  @SubscribeMessage('sos_trigger')
  async handleSosTrigger(
    @MessageBody()
    data: { rideId: string },
    @ConnectedSocket()
    client: Socket,
  ) {
    const state = this.getSocketState(client);
    try {
      const user = await this.usersService.findByIdOrThrow(state.user.userId);
      const latestLoc = await this.trackingService.getLatestLocation(
        state.user.userId,
        data.rideId,
      );

      this.server.to(data.rideId).emit('sos_broadcast', {
        userId: state.user.userId,
        userName: user.name || 'Rider',
        phone: user.phone,
        lat: latestLoc?.lat ?? 0,
        lng: latestLoc?.lng ?? 0,
      });
    } catch (error) {
      this.emitError(client, error);
    }
  }

  @SubscribeMessage('sos_cancel')
  async handleSosCancel(
    @MessageBody()
    data: { rideId: string },
    @ConnectedSocket()
    client: Socket,
  ) {
    const state = this.getSocketState(client);
    try {
      this.server.to(data.rideId).emit('sos_resolved_broadcast', {
        userId: state.user.userId,
      });
    } catch (error) {
      this.emitError(client, error);
    }
  }

  // ======================================
  // PRIVATE HELPERS
  // ======================================

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

    this.logger.warn(`Socket error for ${client.id}: ${message}`);

    client.emit('error', {
      message,
    });
  }
}

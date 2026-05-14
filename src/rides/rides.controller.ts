import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateRideDto } from './dto/create-ride.dto';
import { JoinRideDto } from './dto/join-ride.dto';
import { RidesService } from './rides.service';

type AuthRequest = Request & { user: RequestUser };

@ApiTags('rides')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  @Post()
  create(@Req() request: AuthRequest, @Body() dto: CreateRideDto) {
    return this.ridesService.create(request.user.userId, dto);
  }

  @Get(':rideId')
  getRide(@Param('rideId') rideId: string) {
    return this.ridesService.findByIdOrThrow(rideId);
  }

  @Post(':rideId/join')
  join(
    @Req() request: AuthRequest,
    @Param('rideId') rideId: string,
    @Body() dto: JoinRideDto,
  ) {
    return this.ridesService.join(rideId, request.user.userId, dto);
  }

  @Post(':rideId/leave')
  leave(@Req() request: AuthRequest, @Param('rideId') rideId: string) {
    return this.ridesService.leave(rideId, request.user.userId);
  }

  @Get(':rideId/members')
  getMembers(@Param('rideId') rideId: string) {
    return this.ridesService.getMembers(rideId);
  }

  @Delete(':rideId/members/:userId')
  removeMember(
    @Req() request: AuthRequest,
    @Param('rideId') rideId: string,
    @Param('userId') userId: string,
  ) {
    return this.ridesService.removeMember(rideId, request.user.userId, userId);
  }
}

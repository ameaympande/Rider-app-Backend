import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { LocationHistoryQueryDto } from './dto/location-history-query.dto';
import { SaveLocationDto } from './dto/save-location.dto';
import { TrackingService } from './tracking.service';

type AuthRequest = Request & { user: RequestUser };

@ApiTags('tracking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('location')
  saveLocation(@Req() request: AuthRequest, @Body() dto: SaveLocationDto) {
    return this.trackingService.saveLocation(request.user.userId, dto);
  }

  @Get('live/:rideId')
  getLiveRiders(@Req() request: AuthRequest, @Param('rideId') rideId: string) {
    return this.trackingService.getLiveRiders(rideId, request.user.userId);
  }

  @Get('history/:rideId')
  getHistory(
    @Req() request: AuthRequest,
    @Param('rideId') rideId: string,
    @Query() query: LocationHistoryQueryDto,
  ) {
    return this.trackingService.getHistory(rideId, request.user.userId, query);
  }
}

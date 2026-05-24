import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AddEmergencyContactDto } from './dto/add-emergency-contact.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateBikeDto } from './dto/create-bike.dto';
import { UsersService } from './users.service';

type AuthRequest = Request & { user: RequestUser };

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() request: AuthRequest) {
    return this.usersService.findByIdOrThrow(request.user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(@Req() request: AuthRequest, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(request.user.userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('emergency-contact')
  addEmergencyContact(
    @Req() request: AuthRequest,
    @Body() dto: AddEmergencyContactDto,
  ) {
    return this.usersService.addEmergencyContact(request.user.userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/bikes')
  getBikes(@Req() request: AuthRequest) {
    return this.usersService.findBikes(request.user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/bikes')
  addBike(@Req() request: AuthRequest, @Body() dto: CreateBikeDto) {
    return this.usersService.addBike(request.user.userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('me/bikes/:bikeId')
  deleteBike(@Req() request: AuthRequest, @Param('bikeId') bikeId: string) {
    return this.usersService.deleteBike(request.user.userId, bikeId);
  }
}

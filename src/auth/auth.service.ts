import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes, randomInt } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Model, Types } from 'mongoose';

import { Session, SessionDocument } from '../schemas/session.schema';
import { UsersService } from '../users/users.service';
import { RequestUser } from '../common/interfaces/request-user.interface';

type JwtPayload = {
  sub: string;
  phone: string;
};

@Injectable()
export class AuthService {
  private readonly otpStore = new Map<
    string,
    { otp: string; expiresAt: number }
  >();

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
  ) {}

  sendOtp(phone: string) {
    const otp =
      this.configService.get<string>('NODE_ENV') === 'production'
        ? randomInt(100000, 999999).toString()
        : '123456';

    this.otpStore.set(phone, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return {
      success: true,
      message: 'OTP sent',
    };
  }

  async verifyOtp(phone: string, otp: string) {
    const challenge = this.otpStore.get(phone);

    if (
      !challenge ||
      challenge.otp !== otp ||
      challenge.expiresAt < Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    this.otpStore.delete(phone);

    const user =
      (await this.usersService.findByPhone(phone)) ??
      (await this.usersService.create({
        phone,
      }));

    const tokens = await this.issueTokens(user._id.toString(), user.phone);

    return {
      success: true,
      ...tokens,
      user,
    };
  }

  async refresh(refreshToken: string) {
    const session = await this.sessionModel.findOne({
      refreshToken,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findById(session.userId.toString());

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    session.revoked = true;
    await session.save();

    return this.issueTokens(user._id.toString(), user.phone);
  }

  verifyAccessToken(token: string): RequestUser {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JwtPayload;

      return {
        userId: payload.sub,
        phone: payload.phone,
      };
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async issueTokens(userId: string, phone: string) {
    const accessToken = jwt.sign(
      {
        phone,
      },
      this.jwtSecret,
      {
        subject: userId,
        expiresIn: '15m',
      },
    );
    const refreshToken = randomBytes(48).toString('hex');

    await this.sessionModel.create({
      userId: new Types.ObjectId(userId),
      refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private get jwtSecret() {
    return (
      this.configService.get<string>('JWT_SECRET') ??
      'development-only-change-me'
    );
  }
}

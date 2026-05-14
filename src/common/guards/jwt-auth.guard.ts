import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

import { RequestUser } from '../interfaces/request-user.interface';

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = jwt.verify(
        authorization.replace('Bearer ', ''),
        this.configService.get<string>('JWT_SECRET') as string,
      ) as { sub: string; phone: string };

      request.user = {
        userId: payload.sub,
        phone: payload.phone,
      };
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    return true;
  }
}

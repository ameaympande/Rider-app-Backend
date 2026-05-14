import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinRideDto {
  @ApiPropertyOptional({ example: 'ABC123' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  inviteCode?: string;
}

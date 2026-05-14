import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber } from 'class-validator';

export class SendOtpDto {
  @ApiProperty({ example: '+919999999999' })
  @IsPhoneNumber()
  phone: string;
}

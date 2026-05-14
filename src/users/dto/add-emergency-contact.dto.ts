import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString, MaxLength } from 'class-validator';

export class AddEmergencyContactDto {
  @ApiProperty({ example: 'Rahul' })
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: '+919999999999' })
  @IsPhoneNumber()
  phone: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Aman' })
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: '+919999999999' })
  @IsPhoneNumber()
  phone: string;

  @ApiPropertyOptional({ example: 'KTM Duke 390' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  bikeName?: string;
}

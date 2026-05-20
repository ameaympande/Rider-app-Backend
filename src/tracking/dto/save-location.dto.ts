import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsMongoId,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class SaveLocationDto {
  @ApiProperty()
  @IsMongoId()
  rideId: string;

  @ApiProperty({ example: 18.5204 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 73.8567 })
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiPropertyOptional({ example: 72 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(250)
  speed?: number;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  battery?: number;

  @ApiPropertyOptional({ example: 'RIDING' })
  @IsOptional()
  @IsIn(['RIDING', 'STOPPED', 'OFFLINE', 'SOS'])
  status?: string;
}

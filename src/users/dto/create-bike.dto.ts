import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateBikeDto {
  @ApiProperty({ example: 'Z900' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Kawasaki' })
  @IsString()
  model: string;

  @ApiProperty({ example: 2023 })
  @IsNumber()
  @Min(1900)
  @Max(new Date().getFullYear() + 2)
  year: number;

  @ApiProperty({ example: 4500 })
  @IsNumber()
  @Min(0)
  odometer: number;
}

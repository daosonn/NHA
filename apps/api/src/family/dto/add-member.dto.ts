import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Gender } from '../../generated/prisma/enums';

export class AddMemberDto {
  @ApiProperty({ maxLength: 100, example: '山田 太郎' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName!: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}

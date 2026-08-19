import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateLifeEventDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({
    description:
      'Date only, YYYY-MM-DD — orders the timeline (screen 9). The column ' +
      'is a DATE; a datetime with a timezone offset would shift the day.',
    example: '1988-01-05',
  })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'eventDate must be a date only (YYYY-MM-DD)',
  })
  eventDate!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  place?: string;

  @ApiPropertyOptional({
    maxLength: 50,
    description: 'Free-text life stage/event type — taxonomy TBD (screen 9)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Members involved (screen 10) — must belong to families you are in',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  taggedMemberIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Your own uploaded media, not attached elsewhere. Fixed at creation, ' +
      'like posts.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  mediaIds?: string[];
}

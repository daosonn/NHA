import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '../../common/is-date-only';

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
  @IsDateOnly('eventDate')
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

// `shareToFeed` used to live here — creating a milestone also announced it
// in the feed as an EVENT post. Removed 2026-09-03 (owner's call): a
// timeline edit is record-keeping, not news. Old clients still sending the
// field are harmless — the global ValidationPipe (`whitelist: true`) strips
// unknown properties.

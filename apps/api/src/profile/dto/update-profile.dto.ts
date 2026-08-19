import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// The columns are DATEs; a datetime with a timezone offset would shift
// the stored day ("08:00+09:00" is yesterday in UTC) — same guard as
// LifeEvent.eventDate.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Omitted fields stay unchanged; `null` clears a date, `''` clears the bio. */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    maxLength: 5000,
    description: 'Empty string clears the bio',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bio?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Replaces the full interests list; empty array clears it',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  interests?: string[];

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Date only, YYYY-MM-DD; null clears it (one source per person)',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(DATE_ONLY, {
    message: 'birthDate must be a date only (YYYY-MM-DD)',
  })
  birthDate?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Date only, YYYY-MM-DD; null clears it. Deceased members only',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(DATE_ONLY, {
    message: 'deathDate must be a date only (YYYY-MM-DD)',
  })
  deathDate?: string | null;
}

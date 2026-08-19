import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '../../common/is-date-only';

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
  @IsDateOnly('birthDate')
  birthDate?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Date only, YYYY-MM-DD; null clears it. Deceased members only',
  })
  @IsOptional()
  @IsDateOnly('deathDate')
  deathDate?: string | null;
}

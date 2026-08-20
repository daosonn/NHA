import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsDateOnly } from '../../common/is-date-only';

/** App languages the copy may come back in (docs/03-ai/architecture.md). */
export const SUGGESTION_LOCALES = ['en', 'ja', 'vi'] as const;
export type SuggestionLocale = (typeof SUGGESTION_LOCALES)[number];

export class SuggestionOccasionDto {
  @ApiProperty({ maxLength: 120, example: '62nd birthday' })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({
    example: '2026-03-14',
    description: 'Solar date only (domain-model.md) — YYYY-MM-DD',
  })
  @IsOptional()
  @IsDateOnly('occasion.date')
  date?: string;
}

export class SuggestionConstraintsDto {
  @ApiPropertyOptional({
    maxLength: 80,
    description: 'Free text, passed through verbatim — e.g. "under ¥15,000"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  budget?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 10,
    default: 3,
    description: 'How many ideas to ask for (WBS 2.4.3 wants at least 3)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number;
}

/**
 * One shape for all three suggestion routes (gifts / messages /
 * quality-time): they differ in what the model is asked for, not in what
 * the app has to say. Everything the AI reads beyond these fields is
 * gathered server-side — the app never sends context it could have
 * tampered with.
 */
export class SuggestionRequestDto {
  @ApiProperty({ description: 'The family the subject is being asked about' })
  @IsUUID()
  familyId!: string;

  @ApiProperty({ description: 'Who the suggestion is for (WBS 2.4.1/2.6.1)' })
  @IsUUID()
  memberId!: string;

  @ApiPropertyOptional({ type: SuggestionOccasionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SuggestionOccasionDto)
  occasion?: SuggestionOccasionDto;

  @ApiPropertyOptional({
    maxLength: 1000,
    description:
      'What the user typed into the form (WBS 2.4.2/2.5.1/2.6.2) — the ' +
      'only free text the app contributes',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  userContext?: string;

  @ApiPropertyOptional({ type: SuggestionConstraintsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SuggestionConstraintsDto)
  constraints?: SuggestionConstraintsDto;

  @ApiPropertyOptional({
    enum: SUGGESTION_LOCALES,
    description:
      'Language to answer in. Defaults to the account locale, then en — ' +
      'the app language lives on the device, so it is sent per request.',
  })
  @IsOptional()
  @IsIn(SUGGESTION_LOCALES)
  locale?: SuggestionLocale;
}

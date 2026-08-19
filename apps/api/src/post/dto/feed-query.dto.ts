import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PostType } from '../../generated/prisma/enums';

// Filters are calendar days, not instants — same date-only guard as
// LifeEvent.eventDate and the profile dates.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One query shape serves both the Home feed (WBS 1.2.3 — no filters) and
 * the Memories page (WBS 2.1.2 — the same posts, narrowed by member,
 * time and type). Memories reuse Post; there is no separate model.
 */
export class FeedQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Id of the last post of the previous page (`nextCursor`); omit for the first page',
  })
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @ApiPropertyOptional({
    description:
      'Memories of one member: posts they are tagged in, plus posts they ' +
      'authored if the member is account-linked. Must belong to this family.',
  })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({
    description: 'Posted on or after this day (YYYY-MM-DD, UTC)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(DATE_ONLY, { message: 'from must be a date only (YYYY-MM-DD)' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Posted on or before this day (YYYY-MM-DD, UTC, inclusive)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(DATE_ONLY, { message: 'to must be a date only (YYYY-MM-DD)' })
  to?: string;

  @ApiPropertyOptional({ enum: PostType })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;
}

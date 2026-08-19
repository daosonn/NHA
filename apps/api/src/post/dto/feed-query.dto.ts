import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { IsDateOnly } from '../../common/is-date-only';
import { PostType } from '../../generated/prisma/enums';
import { PaginationQueryDto } from './pagination-query.dto';

/**
 * The family feed's query (WBS 1.2.3) plus the Memories filters
 * (WBS 2.1.2) — the same posts, narrowed by member, calendar day and
 * type. Memories reuse Post; there is no separate model. Comments use
 * the plain PaginationQueryDto base instead.
 */
export class FeedQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Memories of one member: posts they are tagged in (any of their ' +
      'member rows when account-linked), plus posts they authored. Must ' +
      'belong to this family.',
  })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({
    description: 'Posted on or after this day (YYYY-MM-DD, UTC)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateOnly('from')
  from?: string;

  @ApiPropertyOptional({
    description: 'Posted on or before this day (YYYY-MM-DD, UTC, inclusive)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateOnly('to')
  to?: string;

  @ApiPropertyOptional({ enum: PostType })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;
}

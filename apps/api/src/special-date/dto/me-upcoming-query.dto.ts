import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Filters for the aggregate "Dates we keep" feed (mockup 12b's chips) —
 *  each chip is one server query, so the countdown math stays in one place. */
export class MeUpcomingQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Narrow to one family — 403 unless the caller is a member.',
  })
  @IsOptional()
  @IsUUID()
  familyId?: string;

  @ApiPropertyOptional({
    enum: ['FAMILY', 'PERSONAL'],
    description: 'PERSONAL = the caller\'s "Only me" rows.',
  })
  @IsOptional()
  @IsIn(['FAMILY', 'PERSONAL'])
  scope?: 'FAMILY' | 'PERSONAL';
}

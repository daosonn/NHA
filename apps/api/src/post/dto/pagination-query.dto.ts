import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/** Plain cursor pagination — what the comments list takes. The feed's
 *  Memories filters live on FeedQueryDto, which extends this; sharing
 *  one DTO made Swagger advertise filters the comments route ignores. */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Id of the last item of the previous page (`nextCursor`); omit for the first page',
  })
  @IsOptional()
  @IsUUID()
  cursor?: string;
}

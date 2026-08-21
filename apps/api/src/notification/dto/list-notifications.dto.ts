import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
// Generic cursor pagination — same shape the comments list already uses.
// It lives under post/dto for historical reasons; this is its third
// consumer, so it is a candidate for common/ in a separate tidy-up.
import { PaginationQueryDto } from '../../post/dto/pagination-query.dto';

export class ListNotificationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'true = only unread. Omit for everything, newest first (screen 19).',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unreadOnly?: boolean;
}

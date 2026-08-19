import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CreateAlbumDto } from './create-album.dto';

/** `undefined` = unchanged; `null` on `coverMediaId` clears it. */
export class UpdateAlbumDto extends PartialType(CreateAlbumDto) {
  @ApiPropertyOptional({
    nullable: true,
    description: "Must be one of the album's own items; null clears the cover",
  })
  @IsOptional()
  @IsUUID()
  coverMediaId?: string | null;
}

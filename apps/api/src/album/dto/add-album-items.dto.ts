import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export class AddAlbumItemsDto {
  @ApiProperty({
    type: [String],
    description:
      "Your own uploaded media — a post's photo or a standalone upload. " +
      'Already-attached media (a post/memo/life-event) can still be added; ' +
      'an album is a second, independent organization, not another parent.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  mediaIds!: string[];
}

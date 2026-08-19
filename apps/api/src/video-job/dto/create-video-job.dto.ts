import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateVideoJobDto {
  @ApiProperty({
    type: [String],
    description:
      'Photos to build the video from (WBS 2.2.1 multi-select) — any ' +
      'images the requester may view, own or family-shared. Order is ' +
      'preserved into the render.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  mediaIds!: string[];

  @ApiPropertyOptional({
    maxLength: 50,
    description:
      'Render style hint, passed through to the AI service verbatim — ' +
      "the vocabulary is the AI team's",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  style?: string;
}

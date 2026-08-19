import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateMemoDto {
  @ApiProperty({
    maxLength: 120,
    description: 'The bold card line and the detail-screen heading',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({
    maxLength: 5000,
    description: 'The longer text under the title',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({
    maxLength: 30,
    description:
      'Client taxonomy (hobbies/health/gift/memories/todo) — free text ' +
      'like LifeEvent.type, the client owns the vocabulary',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  category?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Your own uploaded media, not attached elsewhere. Fixed at creation, ' +
      'like posts and life events.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  mediaIds?: string[];
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Omitted fields stay unchanged; the post's type is not editable. */
export class UpdatePostDto {
  @ApiPropertyOptional({
    maxLength: 5000,
    description: 'Empty string clears the text',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 — only for EVENT posts' })
  @IsOptional()
  @IsISO8601()
  eventDate?: string;

  @ApiPropertyOptional({ maxLength: 200, description: 'Only for EVENT posts' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  eventTitle?: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description: 'Empty string clears the place',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  place?: string;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Replaces visibility with this full list of family ids; empty = private (WBS 1.5.5)',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID(undefined, { each: true })
  familyIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Replaces the full tag list',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  taggedMemberIds?: string[];
}

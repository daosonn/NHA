import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '../../common/is-date-only';

/** Omitted fields stay unchanged; `null` clears the date or the member. */
export class UpdatePlanDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Replaces the whole plan body — the owner edits the AI draft',
  })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional({
    nullable: true,
    description: 'null detaches the member',
  })
  @IsOptional()
  @IsUUID()
  aboutMemberId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Date only, YYYY-MM-DD; null clears it',
  })
  @IsOptional()
  @IsDateOnly('occasionDate')
  occasionDate?: string | null;
}

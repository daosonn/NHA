import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '../../common/is-date-only';

export class CreatePlanDto {
  @ApiProperty({ maxLength: 120, example: 'Sunday at the bonsai market' })
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The plan itself. Saving a quality-time suggestion stores its ' +
      '`{ steps, why, source }` here, but the shape is deliberately open: ' +
      'the owner edits this freely afterwards and the server never reads it.',
  })
  @IsObject()
  content!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Who the plan is for — a member of one of your families',
  })
  @IsOptional()
  @IsUUID()
  aboutMemberId?: string;

  @ApiPropertyOptional({
    example: '2026-03-14',
    description: 'Solar date only (domain-model.md) — the day it happens',
  })
  @IsOptional()
  @IsDateOnly('occasionDate')
  occasionDate?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString, MaxLength } from 'class-validator';

export class PutInsightDto {
  @ApiProperty({
    type: Object,
    description:
      'Vision-extracted facts (labels/scene/activities) — the shape is ' +
      'owned by the AI team; the API stores it opaquely and never shows it',
  })
  @IsObject()
  insight!: Record<string, unknown>;

  @ApiProperty({
    maxLength: 100,
    description: 'Model that produced it, so a model change can re-run',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  model!: string;
}

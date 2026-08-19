import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * The AI service reports a finished render with `resultPath` (+ mimeType
 * + sizeBytes) or a failed one with `error` — exactly one of the two
 * shapes; the service layer enforces the either/or.
 */
export class CompleteVideoJobDto {
  @ApiPropertyOptional({
    description:
      'Storage key of the rendered file under the shared UPLOAD_DIR volume',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  resultPath?: string;

  @ApiPropertyOptional({ example: 'video/mp4' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  sizeBytes?: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  error?: string;
}

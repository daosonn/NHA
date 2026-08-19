import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * The AI service reports a finished render with `resultPath` + `mimeType`
 * or a failed one with `error` — exactly one of the two shapes; a body
 * carrying both is a 400 (enforced in the service, where the message can
 * say why). The file's size is measured from disk, never trusted from
 * the caller.
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

  @ApiPropertyOptional({
    example: 'video/mp4',
    description: 'Must be a mime type the storage layer serves',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  mimeType?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  error?: string;
}

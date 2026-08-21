import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/** Partial merge — omitted flags keep their stored value. */
export class UpdatePrivacySettingsDto {
  @ApiPropertyOptional({
    description:
      'May the AI service analyse photos this user uploads? (screen 20 ' +
      '"AI permissions", WBS 3.4.4). Turning it OFF also deletes every ' +
      'insight already extracted from their photos — opting out withdraws ' +
      'the traces, not just future analysis. Default true.',
  })
  @IsOptional()
  @IsBoolean()
  allowAiPhotoAnalysis?: boolean;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/** Partial merge — omitted flags keep their stored value. */
export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({
    description:
      'A new moment shared to one of my families (NEW_POST). The likeliest ' +
      'mute: feed noise. Default true.',
  })
  @IsOptional()
  @IsBoolean()
  newPosts?: boolean;

  @ApiPropertyOptional({
    description:
      'Things aimed at me: comments and reactions on my posts, being ' +
      'tagged in a moment (COMMENT / REACTION / MEMBER_TAG). Default true.',
  })
  @IsOptional()
  @IsBoolean()
  aboutMe?: boolean;

  @ApiPropertyOptional({
    description:
      'Birthday / special-date reminders (BIRTHDAY_REMINDER / ' +
      'EVENT_REMINDER, and CARE_REMINDER if 3.3 ships). The literal ' +
      '"bật/tắt nhắc" of WBS 3.4.5. Default true.',
  })
  @IsOptional()
  @IsBoolean()
  reminders?: boolean;
}

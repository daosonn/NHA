import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { UpdatePrivacySettingsDto } from './dto/update-privacy-settings.dto';
import {
  SettingsService,
  type NotificationSettings,
  type PrivacySettings,
} from './settings.service';

/** Screen 20 — account settings. Notification settings (3.4.5) join here. */
@ApiTags('settings')
@ApiBearerAuth()
@Controller('me/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('privacy')
  @ApiOperation({
    summary: 'My privacy settings, defaults applied (WBS 3.4.4)',
  })
  getPrivacy(@CurrentUser() user: AuthUser): Promise<PrivacySettings> {
    return this.settingsService.getPrivacy(user.userId);
  }

  @Patch('privacy')
  @ApiOperation({
    summary:
      'Change privacy settings — partial; turning allowAiPhotoAnalysis ' +
      'off also deletes the insights already extracted from your photos',
  })
  updatePrivacy(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePrivacySettingsDto,
  ): Promise<PrivacySettings> {
    return this.settingsService.updatePrivacy(user.userId, dto);
  }

  @Get('notifications')
  @ApiOperation({
    summary: 'My notification toggles, defaults applied (WBS 3.4.5)',
  })
  getNotifications(
    @CurrentUser() user: AuthUser,
  ): Promise<NotificationSettings> {
    return this.settingsService.getNotificationSettings(user.userId);
  }

  @Patch('notifications')
  @ApiOperation({
    summary:
      'Change notification toggles — partial; a muted group means those ' +
      'notifications are never created for you, not hidden',
  })
  updateNotifications(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettings> {
    return this.settingsService.updateNotificationSettings(user.userId, dto);
  }
}

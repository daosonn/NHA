import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  // AiModule reads the opt-out list to keep opted-out photos off the
  // phase-1 pending feed.
  exports: [SettingsService],
})
export class SettingsModule {}

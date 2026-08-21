import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { NotificationEventsService } from './notification-events.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { ReminderService } from './reminder.service';

@Module({
  // SettingsModule: the 3.4.5 toggles are enforced inside
  // NotificationService's create funnel.
  imports: [SettingsModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationEventsService, ReminderService],
  // `NotificationEventsService` is what feature modules call when
  // something happens; `NotificationService` is for reminders (WBS
  // 3.2/3.3), which have no event to hang off.
  exports: [NotificationService, NotificationEventsService],
})
export class NotificationModule {}

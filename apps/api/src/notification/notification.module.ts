import { Module } from '@nestjs/common';
import { NotificationEventsService } from './notification-events.service';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationEventsService],
  // `NotificationEventsService` is what feature modules call when
  // something happens; `NotificationService` is for reminders (WBS
  // 3.2/3.3), which have no event to hang off.
  exports: [NotificationService, NotificationEventsService],
})
export class NotificationModule {}

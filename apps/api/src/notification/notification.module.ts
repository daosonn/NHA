import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
  // Exported so reminders (WBS 3.2/3.3) and the event triggers can raise
  // notifications without going through HTTP.
  exports: [NotificationService],
})
export class NotificationModule {}

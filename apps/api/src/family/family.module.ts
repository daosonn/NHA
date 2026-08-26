import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { StorageModule } from '../storage/storage.module';
import { FamilyController } from './family.controller';
import { FamilyService } from './family.service';
import {
  FamilyInvitationController,
  InvitationController,
  MyInvitationController,
} from './invitation.controller';
import { InvitationService } from './invitation.service';

@Module({
  imports: [StorageModule, NotificationModule],
  controllers: [
    FamilyController,
    FamilyInvitationController,
    InvitationController,
    MyInvitationController,
  ],
  providers: [FamilyService, InvitationService],
  exports: [FamilyService],
})
export class FamilyModule {}

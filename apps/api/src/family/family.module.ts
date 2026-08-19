import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { FamilyController } from './family.controller';
import { FamilyService } from './family.service';
import {
  FamilyInvitationController,
  InvitationController,
} from './invitation.controller';
import { InvitationService } from './invitation.service';

@Module({
  imports: [StorageModule],
  controllers: [
    FamilyController,
    FamilyInvitationController,
    InvitationController,
  ],
  providers: [FamilyService, InvitationService],
  exports: [FamilyService],
})
export class FamilyModule {}

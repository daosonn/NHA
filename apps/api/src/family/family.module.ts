import { Module } from '@nestjs/common';
import { FamilyController } from './family.controller';
import { FamilyService } from './family.service';
import {
  FamilyInvitationController,
  InvitationController,
} from './invitation.controller';
import { InvitationService } from './invitation.service';

@Module({
  controllers: [
    FamilyController,
    FamilyInvitationController,
    InvitationController,
  ],
  providers: [FamilyService, InvitationService],
  exports: [FamilyService],
})
export class FamilyModule {}

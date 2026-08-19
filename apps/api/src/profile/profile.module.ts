import { Module } from '@nestjs/common';
import { FamilyModule } from '../family/family.module';
import { StorageModule } from '../storage/storage.module';
import {
  MeLifeEventController,
  MemberLifeEventController,
} from './life-event.controller';
import { LifeEventService } from './life-event.service';
import { MeProfileController } from './me-profile.controller';
import { MemberProfileController } from './member-profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [FamilyModule, StorageModule],
  controllers: [
    MeProfileController,
    MemberProfileController,
    MeLifeEventController,
    MemberLifeEventController,
  ],
  providers: [ProfileService, LifeEventService],
  // ProfileService: MemoModule resolves members through findMember.
  exports: [ProfileService, LifeEventService],
})
export class ProfileModule {}

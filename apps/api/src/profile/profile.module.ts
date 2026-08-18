import { Module } from '@nestjs/common';
import { FamilyModule } from '../family/family.module';
import { MeProfileController } from './me-profile.controller';
import { MemberProfileController } from './member-profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [FamilyModule],
  controllers: [MeProfileController, MemberProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}

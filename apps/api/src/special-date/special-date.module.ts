import { Module } from '@nestjs/common';
import { FamilyModule } from '../family/family.module';
import { MeSpecialDateController } from './me-special-date.controller';
import { SpecialDateController } from './special-date.controller';
import { SpecialDateService } from './special-date.service';

@Module({
  imports: [FamilyModule],
  controllers: [SpecialDateController, MeSpecialDateController],
  providers: [SpecialDateService],
})
export class SpecialDateModule {}

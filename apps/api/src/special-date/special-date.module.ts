import { Module } from '@nestjs/common';
import { FamilyModule } from '../family/family.module';
import { SpecialDateController } from './special-date.controller';
import { SpecialDateService } from './special-date.service';

@Module({
  imports: [FamilyModule],
  controllers: [SpecialDateController],
  providers: [SpecialDateService],
})
export class SpecialDateModule {}

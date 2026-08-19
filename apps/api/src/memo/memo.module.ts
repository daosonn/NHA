import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import { StorageModule } from '../storage/storage.module';
import {
  MeMemoController,
  MemberMemoController,
  MemoController,
} from './memo.controller';
import { MemoService } from './memo.service';

@Module({
  imports: [ProfileModule, StorageModule],
  controllers: [MemberMemoController, MeMemoController, MemoController],
  providers: [MemoService],
})
export class MemoModule {}

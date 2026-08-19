import { Module } from '@nestjs/common';
import { ProfileModule } from '../profile/profile.module';
import { StorageModule } from '../storage/storage.module';
import { MemberMemoController, MemoController } from './memo.controller';
import { MemoService } from './memo.service';

@Module({
  imports: [ProfileModule, StorageModule],
  controllers: [MemberMemoController, MemoController],
  providers: [MemoService],
})
export class MemoModule {}

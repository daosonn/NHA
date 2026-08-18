import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { PostController } from './post.controller';
import { PostService } from './post.service';

@Module({
  imports: [StorageModule],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}

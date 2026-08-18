import { Module } from '@nestjs/common';
import { FamilyModule } from '../family/family.module';
import { StorageModule } from '../storage/storage.module';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { FamilyPostsController } from './family-posts.controller';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { ReactionController } from './reaction.controller';
import { ReactionService } from './reaction.service';

@Module({
  imports: [StorageModule, FamilyModule],
  controllers: [
    PostController,
    FamilyPostsController,
    CommentController,
    ReactionController,
  ],
  providers: [PostService, CommentService, ReactionService],
  exports: [PostService],
})
export class PostModule {}

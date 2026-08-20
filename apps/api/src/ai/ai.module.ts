import { Module } from '@nestjs/common';
import { GalleryModule } from '../gallery/gallery.module';
import { MemoModule } from '../memo/memo.module';
import { PostModule } from '../post/post.module';
import { ProfileModule } from '../profile/profile.module';
import { AiController } from './ai.controller';
import { AiInternalController } from './ai-internal.controller';
import { AiServiceGuard } from './ai-service.guard';
import { InsightService } from './insight.service';
import { SuggestionContextService } from './suggestion-context.service';
import { SuggestionService } from './suggestion.service';

@Module({
  imports: [ProfileModule, PostModule, MemoModule, GalleryModule],
  controllers: [AiController, AiInternalController],
  providers: [
    InsightService,
    AiServiceGuard,
    SuggestionContextService,
    SuggestionService,
  ],
})
export class AiModule {}

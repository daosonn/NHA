import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';

/**
 * Video kỷ niệm (màn 27-33 · Sprint 2 WBS 2.2): storyboard qua apps/ai, render ffmpeg
 * 0-token bằng engine port từ demo onemoretime (src/video/engine/*), VideoJob async,
 * share về timeline. Render là media-processing nên nằm ở NestJS — FastAPI chỉ lo AI call.
 */
@Module({
  imports: [AiModule, StorageModule],
  controllers: [VideoController],
  providers: [VideoService],
})
export class VideoModule {}

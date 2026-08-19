import { Module } from '@nestjs/common';
import { AiServiceGuard } from '../ai/ai-service.guard';
import { MediaModule } from '../media/media.module';
import {
  VideoJobController,
  VideoJobInternalController,
} from './video-job.controller';
import { VideoJobService } from './video-job.service';

@Module({
  imports: [MediaModule],
  controllers: [VideoJobController, VideoJobInternalController],
  providers: [VideoJobService, AiServiceGuard],
})
export class VideoJobModule {}

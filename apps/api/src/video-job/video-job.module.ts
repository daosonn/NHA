import { Module } from '@nestjs/common';
import { AiServiceGuard } from '../ai/ai-service.guard';
import { MediaModule } from '../media/media.module';
import { StorageModule } from '../storage/storage.module';
import {
  VideoJobController,
  VideoJobInternalController,
} from './video-job.controller';
import { VideoJobService } from './video-job.service';

@Module({
  imports: [MediaModule, StorageModule],
  controllers: [VideoJobController, VideoJobInternalController],
  providers: [VideoJobService, AiServiceGuard],
})
export class VideoJobModule {}

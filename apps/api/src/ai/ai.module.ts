import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AiClientService } from './ai-client.service';
import { AiContextService } from './ai-context.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { CardService } from './card.service';
import { ProfileService } from './profile.service';
import { ShopsService } from './shops.service';

/**
 * Cổng AI của backend (Sprint 2): gift ideas + message suggestions (màn 21-25).
 * Mọi call provider nằm ở apps/ai (FastAPI); module này chỉ gom context từ DB
 * (authorization membership-based) và orchestrate. Video kỷ niệm ở VideoModule riêng.
 */
@Module({
  imports: [StorageModule],
  controllers: [AiController],
  providers: [AiService, AiClientService, AiContextService, CardService, ProfileService, ShopsService],
  exports: [AiClientService, AiContextService, ProfileService],
})
export class AiModule {}

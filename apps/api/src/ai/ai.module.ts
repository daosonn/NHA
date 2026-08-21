import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { StorageModule } from '../storage/storage.module';
import { AiClientService } from './ai-client.service';
import { AiContextService } from './ai-context.service';
import { AiInternalController } from './ai-internal.controller';
import { AiServiceGuard } from './ai-service.guard';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { CardService } from './card.service';
import { InsightService } from './insight.service';
import { ProfileService } from './profile.service';
import { ShopsService } from './shops.service';

/**
 * Cổng AI của backend (Sprint 2). Mọi call tới provider nằm ở apps/ai (FastAPI);
 * module này gom context từ DB (authorization membership-based) rồi orchestrate.
 *
 * Ở đây có HAI lối vào, cả hai đều giữ:
 *  - `AiController` (màn 21-26): mobile → NestJS → FastAPI, đường đang chạy thật —
 *    gợi ý quà/lời nhắn, thiệp PNG, hồ sơ hai tầng (signal → rollup).
 *  - `AiInternalController` (`/internal/ai/*`, hợp đồng backend 2026-08-19): AI
 *    service tự poll ảnh chưa phân tích rồi đẩy `MediaInsight` trở lại, chặn bằng
 *    `AiServiceGuard` (X-AI-Service-Token). Đường này chưa có bên gọi, nhưng là hợp
 *    đồng đã ký giữa hai team nên không xoá.
 * Route không đụng nhau (`/internal/ai/...` vs `families/.../gift-ideas`).
 */
@Module({
  imports: [StorageModule, SettingsModule],
  controllers: [AiController, AiInternalController],
  providers: [
    AiService,
    AiClientService,
    AiContextService,
    CardService,
    ProfileService,
    ShopsService,
    InsightService,
    AiServiceGuard,
  ],
  exports: [AiClientService, AiContextService, ProfileService],
})
export class AiModule {}

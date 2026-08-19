import { Module } from '@nestjs/common';
import { AiInternalController } from './ai-internal.controller';
import { AiServiceGuard } from './ai-service.guard';
import { InsightService } from './insight.service';

@Module({
  controllers: [AiInternalController],
  providers: [InsightService, AiServiceGuard],
})
export class AiModule {}

import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { AiServiceGuard } from './ai-service.guard';
import { InsightService, type PendingMediaItem } from './insight.service';
import { PutInsightDto } from './dto/put-insight.dto';

const PENDING_DEFAULT_LIMIT = 50;
const PENDING_MAX_LIMIT = 200;

/**
 * Service-to-service surface for the AI team's phase-1 pipeline
 * (docs/03-ai/architecture.md): poll photos to analyse, push extracted
 * insights back into the hidden store. @Public skips the user-JWT guard;
 * AiServiceGuard then demands the shared service token instead.
 */
@ApiTags('internal-ai')
@ApiHeader({ name: 'X-AI-Service-Token', required: true })
@Public()
@UseGuards(AiServiceGuard)
@Controller('internal/ai')
export class AiInternalController {
  constructor(private readonly insightService: InsightService) {}

  @Get('media/pending')
  @ApiOperation({
    summary:
      'Photos not yet analysed, oldest first — storageKey resolves under ' +
      'the shared UPLOAD_DIR volume (?limit 1-200, default 50)',
  })
  listPending(
    @Query('limit', new DefaultValuePipe(PENDING_DEFAULT_LIMIT), ParseIntPipe)
    limit: number,
  ): Promise<PendingMediaItem[]> {
    const clamped = Math.min(Math.max(limit, 1), PENDING_MAX_LIMIT);
    return this.insightService.listPending(clamped);
  }

  @Put('media/:mediaId/insight')
  @ApiOperation({
    summary:
      'Store the vision-extracted facts for one photo (upsert — ' +
      're-analysis overwrites). Never exposed by any user-facing API.',
  })
  putInsight(
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Body() dto: PutInsightDto,
  ): Promise<{ success: boolean }> {
    return this.insightService.putInsight(mediaId, dto);
  }
}

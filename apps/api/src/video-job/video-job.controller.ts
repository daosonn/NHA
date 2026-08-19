import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AiServiceGuard } from '../ai/ai-service.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CompleteVideoJobDto } from './dto/complete-video-job.dto';
import { CreateVideoJobDto } from './dto/create-video-job.dto';
import { VideoJobService, type VideoJobDetail } from './video-job.service';

@ApiTags('video-jobs')
@ApiBearerAuth()
@Controller('video-jobs')
export class VideoJobController {
  constructor(private readonly videoJobService: VideoJobService) {}

  @Post()
  @ApiOperation({
    summary:
      'Generate a video from photos (WBS 2.2.2, async) — returns the job ' +
      'to poll; 503 AI_UNAVAILABLE when the AI service is not reachable',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateVideoJobDto,
  ): Promise<VideoJobDetail> {
    return this.videoJobService.create(user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'My video jobs, newest first (WBS 2.2.3)' })
  list(@CurrentUser() user: AuthUser): Promise<VideoJobDetail[]> {
    return this.videoJobService.listMine(user.userId);
  }

  @Get(':jobId')
  @ApiOperation({
    summary:
      'Poll one job — when DONE, stream the result via GET /media/:resultMediaId (WBS 2.2.3–2.2.4)',
  })
  get(
    @CurrentUser() user: AuthUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<VideoJobDetail> {
    return this.videoJobService.getMine(user.userId, jobId);
  }
}

/** The AI team's completion callback (docs/03-ai/architecture.md). */
@ApiTags('internal-ai')
@ApiHeader({ name: 'X-AI-Service-Token', required: true })
@Public()
@UseGuards(AiServiceGuard)
@Controller('internal/video-jobs')
export class VideoJobInternalController {
  constructor(private readonly videoJobService: VideoJobService) {}

  @Post(':jobId/complete')
  @ApiOperation({
    summary:
      'Report a finished render ({resultPath, mimeType, sizeBytes}) or a ' +
      'failed one ({error}); duplicate reports on a terminal job are ' +
      'acknowledged and ignored',
  })
  complete(
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: CompleteVideoJobDto,
  ): Promise<{ success: boolean }> {
    return this.videoJobService.complete(jobId, dto);
  }
}

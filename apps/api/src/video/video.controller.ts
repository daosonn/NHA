import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { StoryboardResult } from '../ai/ai-client.service';
import {
  CreateVideoJobDto,
  ShareVideoDto,
  StoryboardRequestDto,
} from './dto/video.dto';
import { VideoService, type VideoJobView } from './video.service';

@ApiTags('video')
@ApiBearerAuth()
@Controller()
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get('video-music')
  @ApiOperation({
    summary:
      'Screen 29 — music library grouped by mood (built-in, no copyright issues)',
  })
  music(): ReturnType<VideoService['musicLibrary']> {
    return this.videoService.musicLibrary();
  }

  @Public()
  @Get('video-music/:trackId/file')
  @ApiOperation({
    summary:
      'Screen 29 — preview a LIBRARY track (built-in synth/asset music, no user data → public so <audio> works without headers)',
  })
  async musicFile(
    @Param('trackId') trackId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { path: p, size } = await this.videoService.musicFileFor(trackId);
    res.status(200).set({
      'content-type': 'audio/mp4',
      'content-length': String(size),
      'cache-control': 'public, max-age=86400',
    });
    createReadStream(p).pipe(res);
  }

  @Post('families/:familyId/video-jobs/storyboard')
  @ApiOperation({
    summary:
      'Screen 27→31 — AI storyboard to review/edit BEFORE creating the job (1 AI call, mockable)',
  })
  storyboard(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Body() dto: StoryboardRequestDto,
  ): Promise<StoryboardResult> {
    return this.videoService.storyboard(user.userId, familyId, dto);
  }

  @Post('families/:familyId/video-jobs')
  @ApiOperation({
    summary:
      'Create a video job — mode "ai" (edited plan) or "quick" (stitch photos in my order, 0 AI)',
  })
  create(
    @CurrentUser() user: AuthUser,
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Body() dto: CreateVideoJobDto,
  ): Promise<VideoJobView> {
    return this.videoService.create(user.userId, familyId, dto);
  }

  @Post('video-jobs/:jobId/render')
  @ApiOperation({
    summary:
      'Screen 32 — start async render (poll GET /video-jobs/:id for progress/stage)',
  })
  render(
    @CurrentUser() user: AuthUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<{ ok: boolean }> {
    return this.videoService.startRender(user.userId, jobId);
  }

  @Get('video-jobs')
  @ApiOperation({ summary: 'Screen 33 — "Your videos"' })
  list(@CurrentUser() user: AuthUser): Promise<VideoJobView[]> {
    return this.videoService.listMine(user.userId);
  }

  @Get('video-jobs/:jobId')
  @ApiOperation({ summary: 'Job status + progress + stage + plan' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<VideoJobView> {
    return this.videoService.get(user.userId, jobId);
  }

  @Get('video-jobs/:jobId/file')
  @ApiOperation({
    summary: 'Stream the rendered mp4 (supports HTTP Range for seeking)',
  })
  async file(
    @CurrentUser() user: AuthUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { key, size } = await this.videoService.fileFor(user.userId, jobId);
    const m = /^bytes=(\d*)-(\d*)$/.exec(range ?? '');
    if (m && (m[1] || m[2])) {
      const start = m[1]
        ? parseInt(m[1], 10)
        : Math.max(0, size - parseInt(m[2], 10));
      const end =
        m[1] && m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
      res.status(206).set({
        'content-type': 'video/mp4',
        'content-length': String(end - start + 1),
        'content-range': `bytes ${start}-${end}/${size}`,
        'accept-ranges': 'bytes',
      });
      this.videoService.stream(key, start, end).pipe(res);
    } else {
      res.status(200).set({
        'content-type': 'video/mp4',
        'content-length': String(size),
        'accept-ranges': 'bytes',
      });
      this.videoService.stream(key).pipe(res);
    }
  }

  @Post('video-jobs/:jobId/share')
  @ApiOperation({
    summary:
      'Screen 33 — share to the family timeline as a post with the video attached',
  })
  share(
    @CurrentUser() user: AuthUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
    @Body() dto: ShareVideoDto,
  ): Promise<{ post_id: string }> {
    return this.videoService.share(user.userId, jobId, dto.caption);
  }
}

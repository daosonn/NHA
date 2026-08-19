import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma/prisma.service';
import { VideoJobStatus } from '../generated/prisma/enums';
import { MediaService } from '../media/media.service';
import { CompleteVideoJobDto } from './dto/complete-video-job.dto';
import { CreateVideoJobDto } from './dto/create-video-job.dto';

export interface VideoJobDetail {
  id: string;
  status: VideoJobStatus;
  inputMediaIds: string[];
  /** Stream the finished video via `GET /media/:id` once DONE. */
  resultMediaId: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** How long the dispatch call may take — submission only; the render
 *  itself is async and reports back through the completion callback. */
const DISPATCH_TIMEOUT_MS = 10_000;

/**
 * The backend half of video generation (WBS 2.2,
 * docs/03-ai/architecture.md): NestJS owns the authoritative `VideoJob`
 * row and the result file's Media row; the AI team renders behind the
 * seam. The app only ever talks to NestJS — submit, poll, then stream
 * the result through the existing authorized Media route.
 */
@Injectable()
export class VideoJobService {
  private readonly logger = new Logger(VideoJobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mediaService: MediaService,
  ) {}

  async create(
    userId: string,
    dto: CreateVideoJobDto,
  ): Promise<VideoJobDetail> {
    const serviceUrl = this.config.get<string>('AI_SERVICE_URL');
    const serviceToken = this.config.get<string>('AI_SERVICE_TOKEN');
    if (!serviceUrl || !serviceToken) {
      // Core works without AI (product-overview.md § 14): unconfigured
      // integration answers cleanly instead of stranding a PENDING row.
      throw new ServiceUnavailableException({ code: 'AI_UNAVAILABLE' });
    }

    // Every source photo must exist and be visible to the requester —
    // the same gate as streaming (no oracle about which failed).
    const media = await this.mediaService.assertViewableBatch(
      userId,
      dto.mediaIds,
    );
    if (media.some((item) => !item.mimeType.startsWith('image/'))) {
      throw new BadRequestException('A video is built from photos only');
    }
    // assertViewableBatch returns DB order; the render must follow the
    // user's selection order instead.
    const byId = new Map(media.map((item) => [item.id, item]));
    const mediaPaths = dto.mediaIds.map((id) => byId.get(id)!.storageKey);

    const requester = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { locale: true },
    });

    const job = await this.prisma.videoJob.create({
      data: { requesterUserId: userId, inputMediaIds: dto.mediaIds },
    });

    try {
      const response = await fetch(`${serviceUrl}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AI-Service-Token': serviceToken,
        },
        body: JSON.stringify({
          jobId: job.id,
          mediaPaths,
          locale: requester.locale ?? 'en',
          ...(dto.style && { style: dto.style }),
        }),
        signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`AI service answered ${response.status}`);
      }
    } catch (error) {
      // Submission failed — remove the row so the user can simply retry,
      // rather than leaving a PENDING job nothing will ever complete.
      this.logger.warn(`Video dispatch failed: ${String(error)}`);
      await this.prisma.videoJob.delete({ where: { id: job.id } });
      throw new ServiceUnavailableException({ code: 'AI_UNAVAILABLE' });
    }

    const processing = await this.prisma.videoJob.update({
      where: { id: job.id },
      data: { status: VideoJobStatus.PROCESSING },
    });
    return this.toDetail(processing);
  }

  /** My jobs, newest first (WBS 2.2.3 status list). */
  async listMine(userId: string): Promise<VideoJobDetail[]> {
    const jobs = await this.prisma.videoJob.findMany({
      where: { requesterUserId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return Promise.all(jobs.map((job) => this.toDetail(job)));
  }

  /** 404 for anything that is not the caller's own job. */
  async getMine(userId: string, jobId: string): Promise<VideoJobDetail> {
    const job = await this.prisma.videoJob.findFirst({
      where: { id: jobId, requesterUserId: userId },
    });
    if (!job) {
      throw new NotFoundException('Video job not found');
    }
    return this.toDetail(job);
  }

  /**
   * The completion callback (internal, service token): DONE registers the
   * rendered file as a Media row owned by the requester — standalone
   * media streams uploader-only, so the result is private to whoever
   * asked for it. Duplicate callbacks on a terminal job are acknowledged
   * and ignored (the AI service may retry after a network blip).
   */
  async complete(
    jobId: string,
    dto: CompleteVideoJobDto,
  ): Promise<{ success: boolean }> {
    const job = await this.prisma.videoJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      throw new NotFoundException('Video job not found');
    }
    if (
      job.status === VideoJobStatus.DONE ||
      job.status === VideoJobStatus.FAILED
    ) {
      return { success: true };
    }

    if (dto.error) {
      await this.prisma.videoJob.update({
        where: { id: jobId },
        data: { status: VideoJobStatus.FAILED, error: dto.error },
      });
      return { success: true };
    }
    if (!dto.resultPath || !dto.mimeType || !dto.sizeBytes) {
      throw new BadRequestException(
        'A completion carries either error, or resultPath + mimeType + sizeBytes',
      );
    }
    await this.prisma.$transaction([
      this.prisma.media.create({
        data: {
          uploaderUserId: job.requesterUserId,
          storageKey: dto.resultPath,
          mimeType: dto.mimeType,
          sizeBytes: dto.sizeBytes,
        },
      }),
      this.prisma.videoJob.update({
        where: { id: jobId },
        data: { status: VideoJobStatus.DONE, resultStorageKey: dto.resultPath },
      }),
    ]);
    return { success: true };
  }

  private async toDetail(job: {
    id: string;
    status: VideoJobStatus;
    inputMediaIds: unknown;
    resultStorageKey: string | null;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<VideoJobDetail> {
    // The result Media row is looked up by its storage key — the render
    // writes a fresh key per job, so this resolves to the one row the
    // completion callback created.
    const result = job.resultStorageKey
      ? await this.prisma.media.findFirst({
          where: { storageKey: job.resultStorageKey },
          select: { id: true },
        })
      : null;
    return {
      id: job.id,
      status: job.status,
      inputMediaIds: Array.isArray(job.inputMediaIds)
        ? job.inputMediaIds.filter((id): id is string => typeof id === 'string')
        : [],
      resultMediaId: result?.id ?? null,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}

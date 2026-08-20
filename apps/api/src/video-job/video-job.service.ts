import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveLocale } from '../common/locale';
import { PrismaService } from '../database/prisma/prisma.service';
import type { VideoJob } from '../generated/prisma/client';
import { VideoJobStatus } from '../generated/prisma/enums';
import { MediaService } from '../media/media.service';
import { StorageService } from '../storage/storage.service';
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

/** The statuses a completion callback may still act on. */
const NON_TERMINAL: VideoJobStatus[] = [
  VideoJobStatus.PENDING,
  VideoJobStatus.PROCESSING,
];

/**
 * The backend half of video generation (WBS 2.2,
 * docs/03-ai/architecture.md): NestJS owns the authoritative `VideoJob`
 * row and the result file's Media row; the AI team renders behind the
 * seam. The app only ever talks to NestJS — submit, poll, then stream
 * the result through the existing authorized Media route.
 *
 * Every status transition is a conditional `updateMany` with the current
 * status in the where clause (review 2026-08-19): the completion
 * callback can land while create() is still awaiting the dispatch
 * response, and unconditional writes were able to drag a DONE job back
 * to PROCESSING or double-register its result.
 */
@Injectable()
export class VideoJobService {
  private readonly logger = new Logger(VideoJobService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mediaService: MediaService,
    private readonly storage: StorageService,
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
    // the same gate as streaming (no oracle about which failed). The
    // batch returns selection order, which is the frame order.
    const [media, requester] = await Promise.all([
      this.mediaService.assertViewableBatch(userId, dto.mediaIds),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { locale: true },
      }),
    ]);
    if (media.some((item) => !item.mimeType.startsWith('image/'))) {
      throw new BadRequestException('A video is built from photos only');
    }

    const job = await this.prisma.videoJob.create({
      data: { requesterUserId: userId, inputMediaIds: dto.mediaIds },
    });

    let timedOut = false;
    try {
      const response = await fetch(`${serviceUrl}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AI-Service-Token': serviceToken,
        },
        body: JSON.stringify({
          jobId: job.id,
          mediaPaths: media.map((item) => item.storageKey),
          locale: resolveLocale(requester.locale),
          ...(dto.style && { style: dto.style }),
        }),
        signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`AI service answered ${response.status}`);
      }
    } catch (error) {
      // A timeout is ambiguous — the AI service may have accepted the
      // job and just answered slowly, and its render will complete
      // through the callback. Keep the row PENDING in that case; only a
      // definite refusal (connection error, non-2xx) is safe to roll
      // back so a retry stays clean.
      timedOut =
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError');
      this.logger.warn(
        `Video dispatch ${timedOut ? 'timed out' : 'failed'}: ${String(error)}`,
      );
      if (!timedOut) {
        // Conditional: if the callback already advanced the job (it beat
        // the failure signal), the row is the truth — keep it.
        await this.prisma.videoJob.deleteMany({
          where: { id: job.id, status: VideoJobStatus.PENDING },
        });
        throw new ServiceUnavailableException({ code: 'AI_UNAVAILABLE' });
      }
    }

    if (!timedOut) {
      // Conditional transition: a fast render's callback may already
      // have made the job terminal while we awaited the dispatch — never
      // drag it back to PROCESSING.
      await this.prisma.videoJob.updateMany({
        where: { id: job.id, status: VideoJobStatus.PENDING },
        data: { status: VideoJobStatus.PROCESSING },
      });
    }
    const fresh = await this.prisma.videoJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    return this.toDetail(fresh);
  }

  /** My jobs, newest first (WBS 2.2.3 status list). */
  async listMine(userId: string): Promise<VideoJobDetail[]> {
    const jobs = await this.prisma.videoJob.findMany({
      where: { requesterUserId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return jobs.map((job) => this.toDetail(job));
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
   * asked for it. The job is claimed with a conditional update inside
   * the transaction, so concurrent or repeated callbacks (the AI service
   * may retry after a network blip) settle exactly once; reports on an
   * already-terminal job are acknowledged and ignored.
   */
  async complete(
    jobId: string,
    dto: CompleteVideoJobDto,
  ): Promise<{ success: boolean }> {
    if (dto.error && dto.resultPath) {
      // Ambiguous payloads must fail loudly during integration, not
      // silently discard a rendered video (docs/03-ai/architecture.md).
      throw new BadRequestException(
        'Send either error or resultPath — not both',
      );
    }
    const job = await this.prisma.videoJob.findUnique({
      where: { id: jobId },
      select: { id: true, requesterUserId: true, status: true },
    });
    if (!job) {
      throw new NotFoundException('Video job not found');
    }

    if (dto.error) {
      await this.prisma.videoJob.updateMany({
        where: { id: jobId, status: { in: NON_TERMINAL } },
        data: { status: VideoJobStatus.FAILED, error: dto.error },
      });
      return { success: true }; // count 0 = already terminal: acknowledged
    }

    const { resultPath, mimeType } = dto;
    if (!resultPath || !mimeType) {
      throw new BadRequestException(
        'A completion carries either error, or resultPath + mimeType',
      );
    }
    // The AI service is trusted for rendering, not for Media invariants:
    // the mime must be one the storage layer serves, and the file must
    // actually exist under the shared volume — sizeOf also rejects paths
    // that escape it, and its answer (not the caller's claim) is the
    // stored size.
    if (!this.storage.supports(mimeType)) {
      throw new BadRequestException(`Unsupported result mimeType: ${mimeType}`);
    }
    let sizeBytes: number;
    try {
      sizeBytes = await this.storage.sizeOf(resultPath);
    } catch {
      throw new BadRequestException(
        'resultPath is not a readable file under the storage volume',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Claim the job first; losing the claim (count 0) means another
      // callback already settled it — do nothing, rolling back nothing.
      const claimed = await tx.videoJob.updateMany({
        where: { id: jobId, status: { in: NON_TERMINAL } },
        data: { status: VideoJobStatus.DONE, resultStorageKey: resultPath },
      });
      if (claimed.count === 0) {
        return;
      }
      const resultMedia = await tx.media.create({
        data: {
          uploaderUserId: job.requesterUserId,
          storageKey: resultPath,
          mimeType,
          sizeBytes,
        },
        select: { id: true },
      });
      await tx.videoJob.update({
        where: { id: jobId },
        data: { resultMediaId: resultMedia.id },
      });
    });
    return { success: true };
  }

  private toDetail(job: VideoJob): VideoJobDetail {
    return {
      id: job.id,
      status: job.status,
      // Written exclusively by create() from a validated UUID array.
      inputMediaIds: job.inputMediaIds as string[],
      resultMediaId: job.resultMediaId,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { PutInsightDto } from './dto/put-insight.dto';

/** A photo waiting for phase-1 analysis (docs/03-ai/architecture.md). */
export interface PendingMediaItem {
  id: string;
  /** Relative key under the shared UPLOAD_DIR volume. */
  storageKey: string;
  mimeType: string;
  createdAt: Date;
}

/**
 * The write side of the hidden insight store. Read side deliberately does
 * not exist here — insights are only ever folded into suggestion context
 * (phase 2), filtered by the requester's visibility of the source media.
 * No user-facing endpoint may return them.
 */
@Injectable()
export class InsightService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Photos not yet analysed, oldest first — the AI team polls this and
   * works the backlog down; analysed items drop out on their own.
   * Images only for the MVP (decided 2026-08-19): video analysis is a
   * later conversation.
   */
  async listPending(limit: number): Promise<PendingMediaItem[]> {
    return this.prisma.media.findMany({
      where: { mimeType: { startsWith: 'image/' }, insight: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true, storageKey: true, mimeType: true, createdAt: true },
    });
  }

  /** Upsert: re-analysing (e.g. after a model change) overwrites. */
  async putInsight(
    mediaId: string,
    dto: PutInsightDto,
  ): Promise<{ success: boolean }> {
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: { id: true },
    });
    if (!media) {
      throw new NotFoundException('Media not found');
    }
    // @IsObject() guarantees a plain JSON object; the cast only bridges
    // Prisma's structural InputJsonValue type.
    const insight = dto.insight as Prisma.InputJsonValue;
    await this.prisma.mediaInsight.upsert({
      where: { mediaId },
      create: { mediaId, insight, model: dto.model },
      update: { insight, model: dto.model },
    });
    return { success: true };
  }
}

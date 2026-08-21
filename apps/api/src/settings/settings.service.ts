import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { UpdatePrivacySettingsDto } from './dto/update-privacy-settings.dto';

/**
 * The full privacy shape, defaults applied — what GET returns and what
 * every reader may rely on. One flag today; screen 20 names three more
 * candidates (sharing scope, profile visibility, archive access) that are
 * **deliberately not stored yet**: the archive is already private, the
 * sharing scope is chosen per post in the composer, and profile
 * visibility has no product definition — a stored toggle the server does
 * not enforce would be a lie the UI tells.
 */
export interface PrivacySettings {
  allowAiPhotoAnalysis: boolean;
}

const DEFAULTS: PrivacySettings = {
  allowAiPhotoAnalysis: true,
};

/**
 * Account settings (WBS 3.4.4; 3.4.5 will join it here). Stored in
 * `User.privacySettings` (Json, sprint-0 column) as a partial object —
 * unknown keys are preserved on write so future flags survive old
 * clients, and defaults are applied on read so a null column and a
 * missing key both mean "default", never undefined.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPrivacy(userId: string): Promise<PrivacySettings> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { privacySettings: true },
    });
    return this.withDefaults(user.privacySettings);
  }

  async updatePrivacy(
    userId: string,
    dto: UpdatePrivacySettingsDto,
  ): Promise<PrivacySettings> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { privacySettings: true },
    });
    const stored = this.asRecord(user.privacySettings);
    const next: Record<string, unknown> = { ...stored };
    if (dto.allowAiPhotoAnalysis !== undefined) {
      next.allowAiPhotoAnalysis = dto.allowAiPhotoAnalysis;
    }

    const wasAllowed = this.withDefaults(
      user.privacySettings,
    ).allowAiPhotoAnalysis;
    const optingOut = wasAllowed && dto.allowAiPhotoAnalysis === false;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { privacySettings: next as Prisma.InputJsonValue },
      });
      if (optingOut) {
        // Opting out withdraws the traces, not just future analysis —
        // the same principle as insights cascade-deleting with their
        // photo (docs/03-ai/architecture.md, hidden store).
        const deleted = await tx.mediaInsight.deleteMany({
          where: { media: { uploaderUserId: userId } },
        });
        if (deleted.count > 0) {
          this.logger.log(
            `ai opt-out: withdrew ${deleted.count} insight(s) for ${userId}`,
          );
        }
      }
    });
    return this.withDefaults(next as Prisma.JsonValue);
  }

  /** Uploaders who said no — the phase-1 pending list excludes them. */
  async aiOptedOutUserIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        privacySettings: {
          path: ['allowAiPhotoAnalysis'],
          equals: false,
        },
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  private withDefaults(value: Prisma.JsonValue | null): PrivacySettings {
    const stored = this.asRecord(value);
    return {
      allowAiPhotoAnalysis:
        typeof stored.allowAiPhotoAnalysis === 'boolean'
          ? stored.allowAiPhotoAnalysis
          : DEFAULTS.allowAiPhotoAnalysis,
    };
  }

  private asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value
      : {};
  }
}

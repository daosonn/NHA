import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { NotificationType } from '../generated/prisma/enums';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
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
 * Notification toggles (WBS 3.4.5, screen 20), grouped by *why you got
 * it* rather than one switch per enum value — three decisions a person
 * can actually reason about. Muting means **the row is never created**:
 * delivery is in-app only, so a muted notification would be a row in a
 * list the user asked not to see.
 */
export interface NotificationSettings {
  /** A new moment in one of my families (NEW_POST) — feed noise. */
  newPosts: boolean;
  /** Aimed at me: COMMENT / REACTION on my posts, MEMBER_TAG. */
  aboutMe: boolean;
  /** BIRTHDAY_REMINDER / EVENT_REMINDER (+ CARE_REMINDER if 3.3 ships). */
  reminders: boolean;
}

const NOTIFICATION_DEFAULTS: NotificationSettings = {
  newPosts: true,
  aboutMe: true,
  reminders: true,
};

/** Which toggle governs which type. FAMILY_INVITE and AI_SUGGESTION have
 *  no group (nothing raises them yet) — unmapped types are always
 *  delivered rather than silently lost behind a switch nobody sees. */
const TYPE_GROUP: Partial<
  Record<NotificationType, keyof NotificationSettings>
> = {
  [NotificationType.NEW_POST]: 'newPosts',
  [NotificationType.COMMENT]: 'aboutMe',
  [NotificationType.REACTION]: 'aboutMe',
  [NotificationType.MEMBER_TAG]: 'aboutMe',
  [NotificationType.BIRTHDAY_REMINDER]: 'reminders',
  [NotificationType.EVENT_REMINDER]: 'reminders',
  [NotificationType.CARE_REMINDER]: 'reminders',
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

  async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { notificationSettings: true },
    });
    return this.notificationWithDefaults(user.notificationSettings);
  }

  async updateNotificationSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettings> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { notificationSettings: true },
    });
    const next: Record<string, unknown> = {
      ...this.asRecord(user.notificationSettings),
    };
    for (const key of ['newPosts', 'aboutMe', 'reminders'] as const) {
      if (dto[key] !== undefined) {
        next[key] = dto[key];
      }
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { notificationSettings: next as Prisma.InputJsonValue },
    });
    return this.notificationWithDefaults(next as Prisma.JsonValue);
  }

  /**
   * The enforcement seam: NotificationService funnels every would-be row
   * through here, so events, reminders and any future caller all respect
   * the toggles without knowing they exist. Rows whose recipient muted
   * that type's group are dropped; unmapped types always pass.
   */
  async filterAllowedNotifications<
    T extends { recipientUserId: string; type: NotificationType },
  >(rows: T[]): Promise<T[]> {
    const governed = rows.filter((row) => TYPE_GROUP[row.type] !== undefined);
    if (governed.length === 0) {
      return rows;
    }
    const recipientIds = [...new Set(governed.map((r) => r.recipientUserId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, notificationSettings: true },
    });
    const settings = new Map(
      users.map((user) => [
        user.id,
        this.notificationWithDefaults(user.notificationSettings),
      ]),
    );
    return rows.filter((row) => {
      const group = TYPE_GROUP[row.type];
      if (!group) {
        return true;
      }
      // An unknown recipient id fails at insert anyway; default-allow here
      // keeps that failure loud instead of silently swallowing the row.
      return settings.get(row.recipientUserId)?.[group] ?? true;
    });
  }

  private notificationWithDefaults(
    value: Prisma.JsonValue | null,
  ): NotificationSettings {
    const stored = this.asRecord(value);
    return {
      newPosts:
        typeof stored.newPosts === 'boolean'
          ? stored.newPosts
          : NOTIFICATION_DEFAULTS.newPosts,
      aboutMe:
        typeof stored.aboutMe === 'boolean'
          ? stored.aboutMe
          : NOTIFICATION_DEFAULTS.aboutMe,
      reminders:
        typeof stored.reminders === 'boolean'
          ? stored.reminders
          : NOTIFICATION_DEFAULTS.reminders,
    };
  }

  private asRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value
      : {};
  }
}

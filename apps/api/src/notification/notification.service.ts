import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import type { Notification, Prisma } from '../generated/prisma/client';
import { NotificationType } from '../generated/prisma/enums';
import { ListNotificationsDto } from './dto/list-notifications.dto';

/**
 * One row of screen 19. **No display text**: the server sends the type
 * and the ids, the app writes the sentence. Same rule the special-date
 * widgets already follow — copy is translated in the app, so a Japanese
 * user must not receive an English sentence assembled on the server.
 */
export interface NotificationDetail {
  id: string;
  type: NotificationType;
  /** Type-specific ids the client needs to render and to navigate. */
  payload: unknown;
  /** null = unread. Drives read/unread (3.1.3) and the badge (3.1.4). */
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationPage {
  items: NotificationDetail[];
  nextCursor: string | null;
  /** Unread across everything, not just this page — the badge (3.1.4). */
  unreadCount: number;
}

/** What another module hands over to raise a notification. */
export interface NewNotification {
  recipientUserId: string;
  type: NotificationType;
  payload: Prisma.InputJsonValue;
}

const DEFAULT_LIMIT = 20;

/**
 * In-app notifications (WBS 3.1, screen 19; `database.md` → Notification).
 * Delivery is in-app only for the MVP — no push, no email (`sprint-03.md`).
 *
 * Reminders (3.2, 3.3) do not get their own table: they create rows here
 * with a reminder type, which is why `create`/`createMany` are exported
 * rather than kept private to the read API.
 */
@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Newest first, cursor-paginated — the same convention as the family
   *  feed, so the app reuses its paging code. */
  async list(
    userId: string,
    query: ListNotificationsDto,
  ): Promise<NotificationPage> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const where: Prisma.NotificationWhereInput = {
      recipientUserId: userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      this.countUnread(userId),
    ]);
    const items = rows.slice(0, limit);
    return {
      items: items.map((row) => this.toDetail(row)),
      nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
      unreadCount,
    };
  }

  /** The badge on its own (3.1.4) — the app needs this without paying for
   *  a page of rows it is not going to draw. */
  async unreadCount(userId: string): Promise<{ count: number }> {
    return { count: await this.countUnread(userId) };
  }

  /**
   * Mark one read (3.1.3). Idempotent: re-reading an already-read
   * notification keeps the original `readAt` rather than moving it, so
   * "when did I first see this" stays true.
   */
  async markRead(userId: string, id: string): Promise<NotificationDetail> {
    const row = await this.prisma.notification.findFirst({
      where: { id, recipientUserId: userId },
    });
    if (!row) {
      // 404 for someone else's notification too — its existence is
      // private, same as a memo.
      throw new NotFoundException('Notification not found');
    }
    if (row.readAt) {
      return this.toDetail(row);
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.toDetail(updated);
  }

  /** "Mark all as read" — returns how many actually changed. */
  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { recipientUserId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /**
   * Raise one notification. Called by other modules, never by a route —
   * nothing user-facing may create a notification for someone else.
   *
   * Note for callers: **do not notify someone about their own action**
   * (commenting on your own post, tagging yourself). That rule belongs
   * to the caller, which is the only side that knows who acted.
   */
  create(item: NewNotification): Promise<Notification> {
    return this.prisma.notification.create({ data: item });
  }

  /** Fan-out — one event, many recipients (a new post notifies the
   *  family). One statement instead of one round trip per member. */
  async createMany(items: NewNotification[]): Promise<{ created: number }> {
    if (items.length === 0) {
      return { created: 0 };
    }
    const result = await this.prisma.notification.createMany({ data: items });
    return { created: result.count };
  }

  private countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { recipientUserId: userId, readAt: null },
    });
  }

  private toDetail(row: Notification): NotificationDetail {
    return {
      id: row.id,
      type: row.type,
      payload: row.payload,
      readAt: row.readAt,
      createdAt: row.createdAt,
    };
  }
}

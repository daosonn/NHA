import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { NotificationType } from '../generated/prisma/enums';
import {
  NotificationService,
  type NewNotification,
} from './notification.service';

/**
 * Who gets told when something happens (WBS 3.1). Kept apart from
 * `NotificationService` on purpose: that one stores and reads rows and
 * knows nothing about the product, this one holds the rules — and the
 * rules are where the mistakes live.
 *
 * Three rules apply to everything here:
 *
 * 1. **Never notify someone about their own action.** Commenting on your
 *    own post, tagging yourself, reacting to yourself — silence.
 * 2. **Visibility decides the audience.** A post shared to no family is
 *    private, so it notifies nobody, however many people could otherwise
 *    have been interested.
 * 3. **A failure here must never break the action that caused it.** A
 *    post is published even if writing the notifications fails; the same
 *    fire-and-forget contract `analyzePostInBackground` already uses.
 *    Every method is therefore safe to call without awaiting, and logs
 *    rather than throws.
 */
@Injectable()
export class NotificationEventsService {
  private readonly logger = new Logger(NotificationEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * A new post: everyone in the families it was shared to hears about it,
   * except the author. Anyone **tagged** gets the more specific
   * MEMBER_TAG instead of NEW_POST — being named in a moment is a
   * different event from a moment appearing in the feed, and two rows for
   * one post would read as a bug.
   */
  postCreated(postId: string, authorUserId: string): void {
    void this.safely('postCreated', async () => {
      const post = await this.prisma.post.findUnique({
        where: { id: postId },
        select: {
          families: { select: { familyId: true } },
          memberTags: { select: { member: { select: { userId: true } } } },
        },
      });
      // No families = private to its author (domain-model.md). Nobody hears.
      if (!post || post.families.length === 0) {
        return;
      }

      const taggedUserIds = new Set(
        post.memberTags
          .map((tag) => tag.member.userId)
          .filter((id): id is string => !!id && id !== authorUserId),
      );

      const members = await this.prisma.familyMember.findMany({
        where: {
          familyId: { in: post.families.map((f) => f.familyId) },
          userId: { not: null },
        },
        select: { userId: true },
      });
      // A person in two of the post's families is still one person.
      const audience = new Set(
        members
          .map((m) => m.userId)
          .filter((id): id is string => !!id && id !== authorUserId),
      );

      const rows: NewNotification[] = [
        ...[...taggedUserIds].map((userId) => ({
          recipientUserId: userId,
          type: NotificationType.MEMBER_TAG,
          payload: { postId, actorUserId: authorUserId },
        })),
        ...[...audience]
          .filter((userId) => !taggedUserIds.has(userId))
          .map((userId) => ({
            recipientUserId: userId,
            type: NotificationType.NEW_POST,
            payload: { postId, actorUserId: authorUserId },
          })),
      ];
      await this.notifications.createMany(rows);
    });
  }

  /** A comment tells the post's author, and only them. Post-author
   *  moderation aside, nobody else asked to hear about this thread
   *  (comment moderation decision, 2026-08-18). */
  commentCreated(postId: string, commenterUserId: string): void {
    void this.safely('commentCreated', () =>
      this.notifyPostAuthor(postId, commenterUserId, NotificationType.COMMENT),
    );
  }

  /** Same audience as a comment. Removing a reaction notifies nobody —
   *  there is nothing to tell someone about an un-doing. */
  reactionSet(postId: string, reactorUserId: string): void {
    void this.safely('reactionSet', () =>
      this.notifyPostAuthor(postId, reactorUserId, NotificationType.REACTION),
    );
  }

  private async notifyPostAuthor(
    postId: string,
    actorUserId: string,
    type: NotificationType,
  ): Promise<void> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { authorUserId: true },
    });
    if (!post || post.authorUserId === actorUserId) {
      return;
    }
    await this.notifications.create({
      recipientUserId: post.authorUserId,
      type,
      payload: { postId, actorUserId },
    });
  }

  /** The fire-and-forget contract: log, never throw, never reject. */
  private async safely(
    label: string,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.warn(`notification ${label} failed: ${String(error)}`);
    }
  }
}

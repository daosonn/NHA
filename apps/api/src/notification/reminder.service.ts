import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { NotificationType } from '../generated/prisma/enums';
import {
  NotificationService,
  type NewNotification,
} from './notification.service';

/**
 * How far ahead a reminder fires (WBS 3.2.2). Two moments per occasion:
 * a week out (time to plan) and the day itself. **Assumption to confirm
 * with the team** — no lead time is written down anywhere; per-user
 * tuning belongs to notification settings (3.4.5), which do not exist yet.
 */
const LEAD_DAYS = [7, 0] as const;

/** Twice a day: a reminder day is never missed even if one run lands
 *  mid-deploy, and the dedupe below makes the second run a no-op. */
const RUN_EVERY_MS = 12 * 60 * 60 * 1000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const REMINDER_TYPES = [
  NotificationType.BIRTHDAY_REMINDER,
  NotificationType.EVENT_REMINDER,
] as const;

interface ReminderCandidate {
  recipientUserId: string;
  type: NotificationType;
  /** One occurrence of one occasion at one lead — the idempotency unit. */
  dedupeKey: string;
  payload: Record<string, string | number | null>;
}

/**
 * The reminder generator (WBS 3.2.2): turns LifeProfile birth/death dates
 * and stored SpecialDate rows into Notification rows, through the same
 * `NotificationService` the event triggers use — reminders are the reason
 * that service exports `createMany`.
 *
 * Design constraints, in the order they shaped this:
 *
 * - **Idempotent above all.** Every candidate carries a `dedupeKey`
 *   (occasion + occurrence date + lead) in its payload, and a run inserts
 *   only keys that are not already there. Restarts, overlapping runs and
 *   the twice-daily schedule are therefore all safe; at worst a race
 *   between two instances could double-insert, which the MVP's
 *   single-instance deployment does not have (same note as the video
 *   renderer).
 * - **No display text.** Payloads carry ids, dates and *data snapshots*
 *   (a member's name, a custom occasion's user-entered title) — never a
 *   server-composed sentence. The app writes the copy (screen 19 rule).
 * - **Same calendar rules as the widgets** (special-date.service.ts):
 *   Feb 29 rolls to Mar 1 in non-leap years, a deceased member gets
 *   memorial reminders only, and everything is UTC days — the JST
 *   off-by-one question flagged on Memories applies here too.
 * - Scheduling is a plain interval, not a cron package: one more
 *   dependency is not worth "twice a day". `unref()` keeps the timer
 *   from holding a dying process open.
 */
@Injectable()
export class ReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    // Startup run doubles as catch-up after downtime, and is what a smoke
    // test triggers by simply starting the API.
    void this.safelyRun('startup');
    this.timer = setInterval(() => {
      void this.safelyRun('interval');
    }, RUN_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /** One full pass over every lead. Public so a future admin/internal
   *  trigger can reuse it; nothing user-facing calls this. */
  async runOnce(): Promise<{ created: number }> {
    const today = this.todayUtc();
    const candidates: ReminderCandidate[] = [];
    for (const lead of LEAD_DAYS) {
      const target = new Date(today.getTime() + lead * MS_PER_DAY);
      candidates.push(...(await this.profileReminders(target, lead)));
      candidates.push(...(await this.specialDateReminders(target, lead)));
    }
    const fresh = await this.dropAlreadySent(candidates);
    const rows: NewNotification[] = fresh.map((candidate) => ({
      recipientUserId: candidate.recipientUserId,
      type: candidate.type,
      payload: { ...candidate.payload, dedupeKey: candidate.dedupeKey },
    }));
    const { created } = await this.notifications.createMany(rows);
    if (created > 0) {
      this.logger.log(`reminders: created ${created}`);
    }
    return { created };
  }

  /**
   * Birthdays and memorials for every profile whose date lands on the
   * target day. Tables are people-sized, so the date arithmetic happens
   * in JS where the Feb-29 roll is one line instead of SQL.
   */
  private async profileReminders(
    target: Date,
    lead: number,
  ): Promise<ReminderCandidate[]> {
    const profiles = await this.prisma.lifeProfile.findMany({
      where: {
        OR: [{ birthDate: { not: null } }, { deathDate: { not: null } }],
      },
      select: {
        id: true,
        userId: true,
        memberId: true,
        birthDate: true,
        deathDate: true,
      },
    });
    const out: ReminderCandidate[] = [];
    for (const profile of profiles) {
      // A deceased member gets a memorial only — the widget rule.
      const occasions: {
        date: Date | null;
        type: NotificationType;
        kind: 'birthday' | 'memorial';
      }[] = profile.deathDate
        ? [
            {
              date: profile.deathDate,
              type: NotificationType.EVENT_REMINDER,
              kind: 'memorial',
            },
          ]
        : [
            {
              date: profile.birthDate,
              type: NotificationType.BIRTHDAY_REMINDER,
              kind: 'birthday',
            },
          ];
      for (const occasion of occasions) {
        if (!occasion.date || !this.occursOn(occasion.date, target)) {
          continue;
        }
        out.push(
          ...(await this.forProfile(profile, occasion.kind, occasion.type, {
            target,
            lead,
          })),
        );
      }
    }
    return out;
  }

  /** Fan a profile occasion out to every account that should hear: the
   *  members of every family the person is in, minus the person — nobody
   *  is reminded of their own birthday. */
  private async forProfile(
    profile: { id: string; userId: string | null; memberId: string | null },
    kind: 'birthday' | 'memorial',
    type: NotificationType,
    when: { target: Date; lead: number },
  ): Promise<ReminderCandidate[]> {
    // Every family-scoped appearance of this person: their member rows
    // (linked account = one per family, placeholder = exactly one).
    const memberRows = await this.prisma.familyMember.findMany({
      where: profile.userId
        ? { userId: profile.userId }
        : { id: profile.memberId ?? '' },
      select: {
        id: true,
        familyId: true,
        displayName: true,
        user: { select: { name: true } },
        family: {
          select: {
            members: {
              where: { userId: { not: null } },
              select: { userId: true },
            },
          },
        },
      },
    });
    const occursOn = when.target.toISOString().slice(0, 10);
    const out: ReminderCandidate[] = [];
    const seen = new Set<string>();
    for (const member of memberRows) {
      for (const { userId } of member.family.members) {
        if (!userId || userId === profile.userId || seen.has(userId)) {
          continue; // one reminder per person even across shared families
        }
        seen.add(userId);
        out.push({
          recipientUserId: userId,
          type,
          dedupeKey: `${kind}:${profile.id}:${occursOn}:${when.lead}`,
          payload: {
            kind,
            familyId: member.familyId,
            memberId: member.id,
            // Data snapshot, not server copy — same idea as Memo.aboutName.
            displayName: member.user?.name ?? member.displayName,
            occursOn,
            daysUntil: when.lead,
          },
        });
      }
    }
    return out;
  }

  /** Stored custom occasions landing on the target day (anniversaries
   *  etc., WBS 3.2.3 rows). Everyone in the family hears, including the
   *  people the occasion is about — the couple wants their anniversary. */
  private async specialDateReminders(
    target: Date,
    lead: number,
  ): Promise<ReminderCandidate[]> {
    const rows = await this.prisma.specialDate.findMany({
      select: {
        id: true,
        familyId: true,
        type: true,
        title: true,
        month: true,
        day: true,
        family: {
          select: {
            members: {
              where: { userId: { not: null } },
              select: { userId: true },
            },
          },
        },
      },
    });
    const occursOnIso = target.toISOString().slice(0, 10);
    const out: ReminderCandidate[] = [];
    for (const row of rows) {
      const rolled = new Date(
        Date.UTC(target.getUTCFullYear(), row.month - 1, row.day),
      );
      if (rolled.getTime() !== target.getTime()) {
        continue;
      }
      for (const { userId } of row.family.members) {
        if (!userId) {
          continue;
        }
        out.push({
          recipientUserId: userId,
          type: NotificationType.EVENT_REMINDER,
          dedupeKey: `special:${row.id}:${occursOnIso}:${lead}`,
          payload: {
            kind: 'special',
            familyId: row.familyId,
            specialDateId: row.id,
            specialDateType: row.type,
            // User-entered title = data, not server copy.
            title: row.title,
            occursOn: occursOnIso,
            daysUntil: lead,
          },
        });
      }
    }
    return out;
  }

  /** The idempotency gate: drop every candidate whose (recipient,
   *  dedupeKey) already has a row. One bounded query instead of one per
   *  candidate — reminders younger than the longest lead plus slack. */
  private async dropAlreadySent(
    candidates: ReminderCandidate[],
  ): Promise<ReminderCandidate[]> {
    if (candidates.length === 0) {
      return [];
    }
    const horizon = new Date(Date.now() - 9 * MS_PER_DAY);
    const existing = await this.prisma.notification.findMany({
      where: {
        type: { in: [...REMINDER_TYPES] },
        createdAt: { gte: horizon },
        recipientUserId: {
          in: [...new Set(candidates.map((c) => c.recipientUserId))],
        },
      },
      select: { recipientUserId: true, payload: true },
    });
    const sent = new Set(
      existing.map((row) => {
        const payload = row.payload as { dedupeKey?: string } | null;
        return `${row.recipientUserId}|${payload?.dedupeKey ?? ''}`;
      }),
    );
    return candidates.filter(
      (c) => !sent.has(`${c.recipientUserId}|${c.dedupeKey}`),
    );
  }

  /** Does this annual date land on the target day, Feb 29 rolling to
   *  Mar 1 in non-leap years (Date.UTC overflows forward)? */
  private occursOn(date: Date, target: Date): boolean {
    const rolled = new Date(
      Date.UTC(target.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    return rolled.getTime() === target.getTime();
  }

  private todayUtc(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  private async safelyRun(label: string): Promise<void> {
    try {
      await this.runOnce();
    } catch (error) {
      // A failed pass must never take the API down; the next run retries.
      this.logger.warn(`reminder run (${label}) failed: ${String(error)}`);
    }
  }
}

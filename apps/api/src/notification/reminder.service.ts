import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  MS_PER_DAY,
  occursOn,
  todayUtc,
  type OccurrenceSpec,
} from '../common/occurrence';
import { PrismaService } from '../database/prisma/prisma.service';
import { NotificationType } from '../generated/prisma/enums';
import {
  NotificationService,
  type NewNotification,
} from './notification.service';

/**
 * How far ahead a PROFILE reminder fires (WBS 3.2.2): a week out (time to
 * plan) and the day itself. Stored SpecialDate rows carry their own lead
 * (`remindDaysBefore`, mockup 12c) and no longer use this constant.
 */
const PROFILE_LEAD_DAYS = [7, 0] as const;

/** DTO cap on SpecialDate.remindDaysBefore — the dedupe horizon below is
 *  derived from it so a longer lead can never silently break idempotency
 *  (the old hardcoded 9-day horizon would have re-sent a 10-day lead). */
const MAX_SPECIAL_LEAD_DAYS = 30;

const DEDUPE_HORIZON_DAYS =
  Math.max(...PROFILE_LEAD_DAYS, MAX_SPECIAL_LEAD_DAYS) + 2;

/** Twice a day: a reminder day is never missed even if one run lands
 *  mid-deploy, and the dedupe below makes the second run a no-op. */
const RUN_EVERY_MS = 12 * 60 * 60 * 1000;

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

  /** One full pass. Public so a future admin/internal trigger can reuse
   *  it; nothing user-facing calls this. */
  async runOnce(): Promise<{ created: number }> {
    const today = todayUtc();
    const candidates: ReminderCandidate[] = [];
    for (const lead of PROFILE_LEAD_DAYS) {
      const target = new Date(today.getTime() + lead * MS_PER_DAY);
      candidates.push(...(await this.profileReminders(target, lead)));
    }
    // Stored rows carry their own lead — one table read, leads per row.
    candidates.push(...(await this.specialDateReminders(today)));
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
        if (
          !occasion.date ||
          !occursOn(this.profileSpec(occasion.date), target)
        ) {
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

  /** Stored custom occasions (WBS 3.2.3 rows) — each row carries its own
   *  lead, so this runs once per pass and loops leads per row. Family rows
   *  notify everyone in the family, including the people the occasion is
   *  about (the couple wants their anniversary); personal ("Only me") rows
   *  notify the owner alone. Lunar and one-off dates go through the same
   *  shared `occursOn` the widgets display with, so the reminder day and
   *  the shown day can never disagree. */
  private async specialDateReminders(today: Date): Promise<
    ReminderCandidate[]
  > {
    const rows = await this.prisma.specialDate.findMany({
      select: {
        id: true,
        familyId: true,
        ownerUserId: true,
        type: true,
        title: true,
        month: true,
        day: true,
        isLunar: true,
        repeatsYearly: true,
        year: true,
        remindDaysBefore: true,
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
    const out: ReminderCandidate[] = [];
    for (const row of rows) {
      const spec: OccurrenceSpec = {
        month: row.month,
        day: row.day,
        isLunar: row.isLunar,
        repeatsYearly: row.repeatsYearly,
        year: row.year,
      };
      const recipients =
        row.ownerUserId !== null
          ? [row.ownerUserId]
          : (row.family?.members ?? [])
              .map((m) => m.userId)
              .filter((id): id is string => id !== null);
      for (const lead of new Set([row.remindDaysBefore, 0])) {
        const target = new Date(today.getTime() + lead * MS_PER_DAY);
        if (!occursOn(spec, target)) {
          continue;
        }
        const occursOnIso = target.toISOString().slice(0, 10);
        for (const userId of recipients) {
          out.push({
            recipientUserId: userId,
            type: NotificationType.EVENT_REMINDER,
            dedupeKey: `special:${row.id}:${occursOnIso}:${lead}`,
            payload: {
              kind: 'special',
              scope: row.ownerUserId !== null ? 'PERSONAL' : 'FAMILY',
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
    const horizon = new Date(Date.now() - DEDUPE_HORIZON_DAYS * MS_PER_DAY);
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

  /** A profile birth/death date as an occurrence spec — always solar and
   *  yearly, so Feb-29 rolling stays identical to the widgets'. */
  private profileSpec(date: Date): OccurrenceSpec {
    return {
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      isLunar: false,
      repeatsYearly: true,
      year: null,
    };
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

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { FamilyService } from '../family/family.service';
import { SpecialDateTheme, SpecialDateType } from '../generated/prisma/enums';

export interface SpecialDateMemberRef {
  memberId: string;
  displayName: string;
}

export interface SpecialDateItem {
  /** DERIVED = computed from LifeProfile dates; CUSTOM = a SpecialDate row. */
  source: 'DERIVED' | 'CUSTOM';
  type: SpecialDateType;
  /** Custom occasions only. Derived items carry no text — the client
   *  labels them from type + member names (i18n lives in the app). */
  title: string | null;
  month: number;
  day: number;
  /** Birth year / death year / stored originYear — null when unknown. */
  originYear: number | null;
  /** Years since origin at the next occurrence ("turns 63", "5th"). */
  ordinal: number | null;
  theme: SpecialDateTheme;
  /** ISO date (YYYY-MM-DD) of the next occurrence — computed at request
   *  time, never stored (docs/02-backend/database.md). */
  nextOccurrence: string;
  daysUntil: number;
  members: SpecialDateMemberRef[];
}

export interface UpcomingSpecialDates {
  items: SpecialDateItem[];
}

const DEFAULT_LIMIT = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class SpecialDateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familyService: FamilyService,
  ) {}

  /**
   * Upcoming occasions for the family-home widgets (WBS 1.2.5), soonest
   * first. Two sources (docs/02-backend/database.md → SpecialDate):
   * birthdays/memorials derived from LifeProfile dates, plus any stored
   * `SpecialDate` rows (their CRUD arrives with Sprint 3 task 3.2.3).
   */
  async listUpcoming(
    userId: string,
    familyId: string,
    query: { limit?: number },
  ): Promise<UpcomingSpecialDates> {
    await this.familyService.requireMembership(familyId, userId);
    const today = this.todayUtc();
    const [derived, custom] = await Promise.all([
      this.deriveFromProfiles(familyId, today),
      this.readCustomRows(familyId, today),
    ]);
    const items = [...derived, ...custom]
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, query.limit ?? DEFAULT_LIMIT);
    return { items };
  }

  private async deriveFromProfiles(
    familyId: string,
    today: Date,
  ): Promise<SpecialDateItem[]> {
    const members = await this.prisma.familyMember.findMany({
      where: { familyId },
      select: {
        id: true,
        userId: true,
        displayName: true,
        user: {
          select: {
            name: true,
            lifeProfile: { select: { birthDate: true, deathDate: true } },
          },
        },
        placeholderProfile: { select: { birthDate: true, deathDate: true } },
      },
    });

    const items: SpecialDateItem[] = [];
    for (const member of members) {
      // Same display rule as everywhere else: linked member → global
      // profile + account name, placeholder → its wiki profile.
      const profile = member.userId
        ? member.user?.lifeProfile
        : member.placeholderProfile;
      const displayName = member.user?.name ?? member.displayName;
      if (!profile) {
        continue;
      }
      const ref = { memberId: member.id, displayName };
      // A deceased member gets a memorial, not a birthday widget
      // (assumption to confirm with the team).
      if (profile.birthDate && !profile.deathDate) {
        items.push(
          this.occasion(
            'DERIVED',
            SpecialDateType.BIRTHDAY,
            null,
            profile.birthDate.getUTCMonth() + 1,
            profile.birthDate.getUTCDate(),
            profile.birthDate.getUTCFullYear(),
            SpecialDateTheme.CONFETTI_CANDLES,
            [ref],
            today,
          ),
        );
      }
      if (profile.deathDate) {
        items.push(
          this.occasion(
            'DERIVED',
            SpecialDateType.MEMORIAL,
            null,
            profile.deathDate.getUTCMonth() + 1,
            profile.deathDate.getUTCDate(),
            profile.deathDate.getUTCFullYear(),
            SpecialDateTheme.FLORAL_BORDER,
            [ref],
            today,
          ),
        );
      }
    }
    return items;
  }

  private async readCustomRows(
    familyId: string,
    today: Date,
  ): Promise<SpecialDateItem[]> {
    const rows = await this.prisma.specialDate.findMany({
      where: { familyId },
      select: {
        type: true,
        title: true,
        month: true,
        day: true,
        originYear: true,
        theme: true,
        members: {
          select: {
            member: {
              select: {
                id: true,
                displayName: true,
                user: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    return rows.map((row) =>
      this.occasion(
        'CUSTOM',
        row.type,
        row.title,
        row.month,
        row.day,
        row.originYear,
        row.theme,
        row.members.map((tag) => ({
          memberId: tag.member.id,
          displayName: tag.member.user?.name ?? tag.member.displayName,
        })),
        today,
      ),
    );
  }

  private occasion(
    source: 'DERIVED' | 'CUSTOM',
    type: SpecialDateType,
    title: string | null,
    month: number,
    day: number,
    originYear: number | null,
    theme: SpecialDateTheme,
    members: SpecialDateMemberRef[],
    today: Date,
  ): SpecialDateItem {
    const next = this.nextOccurrence(month, day, today);
    return {
      source,
      type,
      title,
      month,
      day,
      originYear,
      ordinal: originYear !== null ? next.getUTCFullYear() - originYear : null,
      theme,
      nextOccurrence: next.toISOString().slice(0, 10),
      daysUntil: Math.round((next.getTime() - today.getTime()) / MS_PER_DAY),
      members,
    };
  }

  /** Next annual occurrence on/after today. Feb 29 rolls to Mar 1 in
   *  non-leap years (Date.UTC overflows forward). */
  private nextOccurrence(month: number, day: number, today: Date): Date {
    const thisYear = new Date(Date.UTC(today.getUTCFullYear(), month - 1, day));
    if (thisYear.getTime() >= today.getTime()) {
      return thisYear;
    }
    return new Date(Date.UTC(today.getUTCFullYear() + 1, month - 1, day));
  }

  private todayUtc(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }
}

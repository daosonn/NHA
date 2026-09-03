import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireTrimmed } from '../common/input';
import {
  MS_PER_DAY,
  nextOccurrenceOf,
  OccurrenceSpec,
  todayUtc,
} from '../common/occurrence';
import { lunarOneOffSolarDate } from '../common/lunar';
import { PrismaService } from '../database/prisma/prisma.service';
import { assertTaggedMembers, ownFamilyIds } from '../family/member-tags';
import { FamilyService } from '../family/family.service';
import { SpecialDateTheme, SpecialDateType } from '../generated/prisma/enums';
import { CreateSpecialDateDto } from './dto/create-special-date.dto';
import { UpdateSpecialDateDto } from './dto/update-special-date.dto';

export interface SpecialDateMemberRef {
  memberId: string;
  displayName: string;
}

export type SpecialDateScope = 'FAMILY' | 'PERSONAL';

export interface SpecialDateItem {
  /** DERIVED = computed from LifeProfile dates; CUSTOM = a SpecialDate row. */
  source: 'DERIVED' | 'CUSTOM';
  /** Row id — null ⇔ DERIVED (nothing stored to address). Lets the client
   *  open a detail/edit screen, which the old id-less shape could not. */
  id: string | null;
  scope: SpecialDateScope;
  /** null ⇔ PERSONAL ("Only me"). */
  familyId: string | null;
  /** Data snapshot for the family chip on the aggregate list. */
  familyName: string | null;
  type: SpecialDateType;
  /** Custom occasions only. Derived items carry no text — the client
   *  labels them from type + member names (i18n lives in the app). */
  title: string | null;
  /** month/day are in the row's own calendar: lunar when isLunar. */
  month: number;
  day: number;
  /** true ⇒ Vietnamese lunar (tz +7); nextOccurrence below is always the
   *  SOLAR date it lands on this time around. */
  isLunar: boolean;
  repeatsYearly: boolean;
  /** One-off only — in the row's own calendar (lunar year when isLunar). */
  year: number | null;
  /** Birth year / death year / stored originYear — null when unknown. */
  originYear: number | null;
  /** Years since origin at the next occurrence ("turns 63", "5th"). */
  ordinal: number | null;
  /** In-app bell lead, days before (plus day-of). Fixed 7 on DERIVED. */
  remindDaysBefore: number;
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

/** A stored row as the management screen edits it — with its id, unlike
 *  the merged widget items above. */
export interface SpecialDateDetail {
  id: string;
  scope: SpecialDateScope;
  familyId: string | null;
  type: SpecialDateType;
  title: string;
  month: number;
  day: number;
  isLunar: boolean;
  repeatsYearly: boolean;
  year: number | null;
  originYear: number | null;
  remindDaysBefore: number;
  theme: SpecialDateTheme;
  /** Computed here so the client never needs its own lunar converter.
   *  null = a one-off whose date has already passed. */
  nextOccurrence: string | null;
  daysUntil: number | null;
  members: SpecialDateMemberRef[];
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

const detailSelect = {
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
  originYear: true,
  remindDaysBefore: true,
  theme: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
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
} as const;

interface SpecialDateRow {
  id: string;
  familyId: string | null;
  ownerUserId: string | null;
  type: SpecialDateType;
  title: string;
  month: number;
  day: number;
  isLunar: boolean;
  repeatsYearly: boolean;
  year: number | null;
  originYear: number | null;
  remindDaysBefore: number;
  theme: SpecialDateTheme;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  members: {
    member: { id: string; displayName: string; user: { name: string } | null };
  }[];
}

/** The tuple assertDateShape validates — always the RESULTING values, so a
 *  month-only PATCH cannot leave Feb 31 (or lunar day 31) behind. */
interface DateShape {
  month: number;
  day: number;
  isLunar: boolean;
  repeatsYearly: boolean;
  year: number | null;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_AGGREGATE_LIMIT = 20;
/** DERIVED reminders come from the profile job's fixed [7, 0] leads. */
const DERIVED_LEAD_DAYS = 7;

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
   * `SpecialDate` rows.
   */
  async listUpcoming(
    userId: string,
    familyId: string,
    query: { limit?: number },
  ): Promise<UpcomingSpecialDates> {
    await this.familyService.requireMembership(familyId, userId);
    const familyNames = await this.familyNamesOf([familyId]);
    const today = todayUtc();
    const [derived, custom] = await Promise.all([
      this.deriveFromProfiles([familyId], familyNames, today),
      this.readCustomRows({ familyId }, familyNames, today),
    ]);
    const items = [...derived, ...custom]
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, query.limit ?? DEFAULT_LIMIT);
    return { items };
  }

  /**
   * "Dates we keep" (mockup 12a/12b): every upcoming date the caller can
   * see — derived + custom across ALL their families, plus their personal
   * ("Only me") rows. Filters narrow server-side so the client's chips are
   * one query each.
   */
  async listUpcomingForUser(
    userId: string,
    query: { limit?: number; familyId?: string; scope?: SpecialDateScope },
  ): Promise<UpcomingSpecialDates> {
    if (query.familyId !== undefined) {
      // 403, not silence — asking for a family you're not in is a caller bug.
      await this.familyService.requireMembership(query.familyId, userId);
    }
    const memberships = await this.prisma.familyMember.findMany({
      where: { userId },
      select: { familyId: true, family: { select: { name: true } } },
    });
    const familyIds = memberships
      .map((m) => m.familyId)
      .filter((id) => query.familyId === undefined || id === query.familyId);
    const familyNames = new Map(
      memberships.map((m) => [m.familyId, m.family.name]),
    );
    const today = todayUtc();

    const wantFamily = query.scope !== 'PERSONAL' && familyIds.length > 0;
    const wantPersonal =
      query.scope !== 'FAMILY' && query.familyId === undefined;
    const [derived, customFamily, personal] = await Promise.all([
      wantFamily
        ? this.deriveFromProfiles(familyIds, familyNames, today)
        : Promise.resolve([]),
      wantFamily
        ? this.readCustomRows(
            { familyId: { in: familyIds } },
            familyNames,
            today,
          )
        : Promise.resolve([]),
      wantPersonal
        ? this.readCustomRows({ ownerUserId: userId }, familyNames, today)
        : Promise.resolve([]),
    ]);
    const items = [...derived, ...customFamily, ...personal]
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, query.limit ?? DEFAULT_AGGREGATE_LIMIT);
    return { items };
  }

  private async familyNamesOf(
    familyIds: string[],
  ): Promise<Map<string, string>> {
    const rows = await this.prisma.family.findMany({
      where: { id: { in: familyIds } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  private async deriveFromProfiles(
    familyIds: string[],
    familyNames: Map<string, string>,
    today: Date,
  ): Promise<SpecialDateItem[]> {
    const members = await this.prisma.familyMember.findMany({
      where: { familyId: { in: familyIds } },
      select: {
        id: true,
        familyId: true,
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
      const scope = {
        familyId: member.familyId,
        familyName: familyNames.get(member.familyId) ?? null,
        members: [{ memberId: member.id, displayName }],
      };
      // A deceased member gets a memorial, not a birthday widget
      // (assumption to confirm with the team).
      if (profile.birthDate && !profile.deathDate) {
        const item = this.derivedOccasion(
          SpecialDateType.BIRTHDAY,
          profile.birthDate,
          SpecialDateTheme.CONFETTI_CANDLES,
          scope,
          today,
        );
        if (item) items.push(item);
      }
      if (profile.deathDate) {
        const item = this.derivedOccasion(
          SpecialDateType.MEMORIAL,
          profile.deathDate,
          SpecialDateTheme.FLORAL_BORDER,
          scope,
          today,
        );
        if (item) items.push(item);
      }
    }
    return items;
  }

  private derivedOccasion(
    type: SpecialDateType,
    origin: Date,
    theme: SpecialDateTheme,
    scope: {
      familyId: string;
      familyName: string | null;
      members: SpecialDateMemberRef[];
    },
    today: Date,
  ): SpecialDateItem | null {
    return this.occasion(
      {
        source: 'DERIVED',
        id: null,
        scope: 'FAMILY',
        familyId: scope.familyId,
        familyName: scope.familyName,
        type,
        title: null,
        month: origin.getUTCMonth() + 1,
        day: origin.getUTCDate(),
        isLunar: false,
        repeatsYearly: true,
        year: null,
        originYear: origin.getUTCFullYear(),
        remindDaysBefore: DERIVED_LEAD_DAYS,
        theme,
        members: scope.members,
      },
      today,
    );
  }

  private async readCustomRows(
    where: { familyId?: string | { in: string[] }; ownerUserId?: string },
    familyNames: Map<string, string>,
    today: Date,
  ): Promise<SpecialDateItem[]> {
    const rows = await this.prisma.specialDate.findMany({
      where,
      select: detailSelect,
    });
    const items: SpecialDateItem[] = [];
    for (const row of rows) {
      const item = this.occasion(
        {
          source: 'CUSTOM',
          id: row.id,
          scope: row.ownerUserId !== null ? 'PERSONAL' : 'FAMILY',
          familyId: row.familyId,
          familyName:
            row.familyId !== null
              ? (familyNames.get(row.familyId) ?? null)
              : null,
          type: row.type,
          title: row.title,
          month: row.month,
          day: row.day,
          isLunar: row.isLunar,
          repeatsYearly: row.repeatsYearly,
          year: row.year,
          originYear: row.originYear,
          remindDaysBefore: row.remindDaysBefore,
          theme: row.theme,
          members: this.memberRefs(row),
        },
        today,
      );
      if (item) items.push(item); // null = one-off already past — omitted
    }
    return items;
  }

  /**
   * The stored rows with their ids, calendar order — what the edit side
   * uses. The widget GETs above merge these with the derived occasions;
   * derived items carry `id: null` and cannot be edited here (their date
   * lives on the profile).
   */
  async listCustom(
    userId: string,
    familyId: string,
  ): Promise<SpecialDateDetail[]> {
    await this.familyService.requireMembership(familyId, userId);
    return this.readDetails({ familyId });
  }

  /** The caller's own "Only me" rows, calendar order. */
  async listCustomPersonal(userId: string): Promise<SpecialDateDetail[]> {
    return this.readDetails({ ownerUserId: userId });
  }

  private async readDetails(where: {
    familyId?: string;
    ownerUserId?: string;
  }): Promise<SpecialDateDetail[]> {
    const rows = await this.prisma.specialDate.findMany({
      where,
      orderBy: [{ month: 'asc' }, { day: 'asc' }, { createdAt: 'asc' }],
      select: detailSelect,
    });
    return rows.map((row) => this.toDetail(row));
  }

  async getOne(
    userId: string,
    familyId: string,
    specialDateId: string,
  ): Promise<SpecialDateDetail> {
    await this.familyService.requireMembership(familyId, userId);
    const row = await this.prisma.specialDate.findFirst({
      where: { id: specialDateId, familyId },
      select: detailSelect,
    });
    if (!row) {
      throw new NotFoundException('Special date not found');
    }
    return this.toDetail(row);
  }

  /** 404 for someone else's personal row — its existence is private, the
   *  same rule memos follow. */
  async getPersonal(
    userId: string,
    specialDateId: string,
  ): Promise<SpecialDateDetail> {
    const row = await this.prisma.specialDate.findFirst({
      where: { id: specialDateId, ownerUserId: userId },
      select: detailSelect,
    });
    if (!row) {
      throw new NotFoundException('Special date not found');
    }
    return this.toDetail(row);
  }

  /** Any family member creates/edits/deletes — the same no-roles wiki
   *  spirit as placeholder profiles (domain-model.md). `createdById` is
   *  provenance, not ownership. */
  async create(
    userId: string,
    familyId: string,
    dto: CreateSpecialDateDto,
  ): Promise<SpecialDateDetail> {
    await this.familyService.requireMembership(familyId, userId);
    return this.createRow(userId, { familyId }, [familyId], dto);
  }

  /** "Only me": scope is the owner; members may come from ANY family the
   *  creator belongs to (a personal giỗ is usually about a placeholder in
   *  one of their trees). */
  async createPersonal(
    userId: string,
    dto: CreateSpecialDateDto,
  ): Promise<SpecialDateDetail> {
    const allowed = await ownFamilyIds(this.prisma, userId);
    return this.createRow(userId, { ownerUserId: userId }, allowed, dto);
  }

  private async createRow(
    userId: string,
    scope: { familyId?: string; ownerUserId?: string },
    allowedFamilyIds: string[],
    dto: CreateSpecialDateDto,
  ): Promise<SpecialDateDetail> {
    const title = requireTrimmed(dto.title, 'A special date needs a title');
    this.assertDateShape({
      month: dto.month,
      day: dto.day,
      isLunar: dto.isLunar ?? false,
      repeatsYearly: dto.repeatsYearly ?? true,
      year: dto.year ?? null,
    });
    const memberIds = dto.memberIds ?? [];
    await assertTaggedMembers(
      this.prisma,
      memberIds,
      allowedFamilyIds,
      scope.familyId !== undefined
        ? 'Special-date members must belong to this family'
        : 'Special-date members must belong to one of your families',
    );
    const row = await this.prisma.specialDate.create({
      data: {
        familyId: scope.familyId ?? null,
        ownerUserId: scope.ownerUserId ?? null,
        type: dto.type,
        title,
        month: dto.month,
        day: dto.day,
        isLunar: dto.isLunar ?? false,
        repeatsYearly: dto.repeatsYearly ?? true,
        year: dto.repeatsYearly === false ? (dto.year ?? null) : null,
        originYear: dto.originYear ?? null,
        remindDaysBefore: dto.remindDaysBefore ?? 7,
        theme: dto.theme,
        createdById: userId,
        members: { create: memberIds.map((memberId) => ({ memberId })) },
      },
      select: detailSelect,
    });
    return this.toDetail(row);
  }

  async update(
    userId: string,
    familyId: string,
    specialDateId: string,
    dto: UpdateSpecialDateDto,
  ): Promise<SpecialDateDetail> {
    await this.familyService.requireMembership(familyId, userId);
    const existing = await this.findRow({ id: specialDateId, familyId });
    return this.updateRow(specialDateId, existing, [familyId], dto);
  }

  async updatePersonal(
    userId: string,
    specialDateId: string,
    dto: UpdateSpecialDateDto,
  ): Promise<SpecialDateDetail> {
    const existing = await this.findRow({
      id: specialDateId,
      ownerUserId: userId,
    });
    const allowed = await ownFamilyIds(this.prisma, userId);
    return this.updateRow(specialDateId, existing, allowed, dto);
  }

  private async updateRow(
    specialDateId: string,
    existing: DateShape,
    allowedFamilyIds: string[],
    dto: UpdateSpecialDateDto,
  ): Promise<SpecialDateDetail> {
    if (dto.title !== undefined) {
      requireTrimmed(dto.title, 'A special date needs a title');
    }
    // Validate the *resulting* tuple — changing only the month must not
    // leave Feb 31 (or a lunar day 31) behind; flipping repeatsYearly back
    // on quietly drops the now-meaningless year.
    const repeatsYearly = dto.repeatsYearly ?? existing.repeatsYearly;
    const resulting: DateShape = {
      month: dto.month ?? existing.month,
      day: dto.day ?? existing.day,
      isLunar: dto.isLunar ?? existing.isLunar,
      repeatsYearly,
      year: repeatsYearly ? null : (dto.year ?? existing.year),
    };
    this.assertDateShape(resulting);
    if (dto.memberIds !== undefined) {
      await assertTaggedMembers(
        this.prisma,
        dto.memberIds,
        allowedFamilyIds,
        allowedFamilyIds.length === 1
          ? 'Special-date members must belong to this family'
          : 'Special-date members must belong to one of your families',
      );
    }
    const row = await this.prisma.specialDate.update({
      where: { id: specialDateId },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.month !== undefined && { month: dto.month }),
        ...(dto.day !== undefined && { day: dto.day }),
        ...(dto.isLunar !== undefined && { isLunar: dto.isLunar }),
        ...(dto.repeatsYearly !== undefined && {
          repeatsYearly: dto.repeatsYearly,
        }),
        // year follows the resulting shape, not the raw dto — see above.
        year: resulting.year,
        ...(dto.originYear !== undefined && { originYear: dto.originYear }),
        ...(dto.remindDaysBefore !== undefined && {
          remindDaysBefore: dto.remindDaysBefore,
        }),
        ...(dto.theme !== undefined && { theme: dto.theme }),
        ...(dto.memberIds !== undefined && {
          members: {
            deleteMany: {},
            create: dto.memberIds.map((memberId) => ({ memberId })),
          },
        }),
      },
      select: detailSelect,
    });
    return this.toDetail(row);
  }

  async remove(
    userId: string,
    familyId: string,
    specialDateId: string,
  ): Promise<{ success: boolean }> {
    await this.familyService.requireMembership(familyId, userId);
    await this.findRow({ id: specialDateId, familyId });
    await this.prisma.specialDate.delete({ where: { id: specialDateId } });
    return { success: true };
  }

  async removePersonal(
    userId: string,
    specialDateId: string,
  ): Promise<{ success: boolean }> {
    await this.findRow({ id: specialDateId, ownerUserId: userId });
    await this.prisma.specialDate.delete({ where: { id: specialDateId } });
    return { success: true };
  }

  /** 404 for a row outside the caller's scope — same as members and
   *  relationships (and, for personal rows, the memo privacy rule). */
  private async findRow(where: {
    id: string;
    familyId?: string;
    ownerUserId?: string;
  }): Promise<DateShape> {
    const row = await this.prisma.specialDate.findFirst({
      where,
      select: {
        month: true,
        day: true,
        isLunar: true,
        repeatsYearly: true,
        year: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Special date not found');
    }
    return row;
  }

  /**
   * One gate for every write. Solar recurring keeps the old probe (leap
   * year 2000, so Feb 29 stays legal and rolls at display time); a solar
   * one-off probes its ACTUAL year — Feb 29 2027 is a lie, not a date.
   * Lunar days stop at 30; a lunar one-off must resolve via the converter.
   */
  private assertDateShape(shape: DateShape): void {
    const { month, day, isLunar, repeatsYearly, year } = shape;
    if (!repeatsYearly && year === null) {
      throw new BadRequestException('A one-off date needs its year');
    }
    if (isLunar) {
      if (month < 1 || month > 12 || day < 1 || day > 30) {
        throw new BadRequestException(
          `lunar ${month}/${day} is not a real date`,
        );
      }
      if (!repeatsYearly && lunarOneOffSolarDate(year!, month, day) === null) {
        throw new BadRequestException(
          `lunar ${month}/${day}/${year} is not a real date`,
        );
      }
      return;
    }
    const probeYear = repeatsYearly ? 2000 : year!;
    const probe = new Date(Date.UTC(probeYear, month - 1, day));
    if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
      throw new BadRequestException(`${month}/${day} is not a real date`);
    }
  }

  private memberRefs(row: {
    members: SpecialDateRow['members'];
  }): SpecialDateMemberRef[] {
    return row.members.map((tag) => ({
      memberId: tag.member.id,
      displayName: tag.member.user?.name ?? tag.member.displayName,
    }));
  }

  private toDetail(row: SpecialDateRow): SpecialDateDetail {
    const next = nextOccurrenceOf(this.specOf(row), todayUtc());
    return {
      id: row.id,
      scope: row.ownerUserId !== null ? 'PERSONAL' : 'FAMILY',
      familyId: row.familyId,
      type: row.type,
      title: row.title,
      month: row.month,
      day: row.day,
      isLunar: row.isLunar,
      repeatsYearly: row.repeatsYearly,
      year: row.year,
      originYear: row.originYear,
      remindDaysBefore: row.remindDaysBefore,
      theme: row.theme,
      nextOccurrence: next === null ? null : next.toISOString().slice(0, 10),
      daysUntil:
        next === null
          ? null
          : Math.round((next.getTime() - todayUtc().getTime()) / MS_PER_DAY),
      members: this.memberRefs(row),
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private specOf(row: {
    month: number;
    day: number;
    isLunar: boolean;
    repeatsYearly: boolean;
    year: number | null;
  }): OccurrenceSpec {
    return {
      month: row.month,
      day: row.day,
      isLunar: row.isLunar,
      repeatsYearly: row.repeatsYearly,
      year: row.year,
    };
  }

  /** Shapes one list item; null when the date never occurs again (one-off
   *  past) — those vanish from every list and never remind. */
  private occasion(
    fields: Omit<SpecialDateItem, 'ordinal' | 'nextOccurrence' | 'daysUntil'>,
    today: Date,
  ): SpecialDateItem | null {
    const next = nextOccurrenceOf(this.specOf(fields), today);
    if (next === null) {
      return null;
    }
    return {
      ...fields,
      ordinal:
        fields.originYear !== null
          ? next.getUTCFullYear() - fields.originYear
          : null,
      nextOccurrence: next.toISOString().slice(0, 10),
      daysUntil: Math.round((next.getTime() - today.getTime()) / MS_PER_DAY),
    };
  }
}

import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '../generated/prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * The one home of the member-tag boundary check (extracted 2026-08-19;
 * post and life-event tagging had drifted into two copies). Every tagged
 * member must exist and belong to one of `allowedFamilyIds` — the caller
 * decides the boundary: a post shared to families allows those, a private
 * post or an own-timeline event allows the editor's families, a
 * member-scoped timeline allows that one family.
 */
export async function assertTaggedMembers(
  db: Db,
  taggedMemberIds: string[],
  allowedFamilyIds: string[],
  message = 'Tagged members must belong to the allowed families',
): Promise<void> {
  if (taggedMemberIds.length === 0) {
    return;
  }
  const members = await db.familyMember.findMany({
    where: { id: { in: taggedMemberIds } },
    select: { familyId: true },
  });
  if (members.length !== taggedMemberIds.length) {
    throw new NotFoundException('Some tagged members were not found');
  }
  const allowed = new Set(allowedFamilyIds);
  if (members.some((member) => !allowed.has(member.familyId))) {
    throw new BadRequestException(message);
  }
}

/** Every family this user belongs to — the default tag boundary when no
 *  narrower one applies. */
export async function ownFamilyIds(db: Db, userId: string): Promise<string[]> {
  const memberships = await db.familyMember.findMany({
    where: { userId },
    select: { familyId: true },
  });
  return memberships.map((membership) => membership.familyId);
}

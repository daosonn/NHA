import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  Gender,
  PostType,
  RelationshipType,
} from '../src/generated/prisma/enums';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// Shared login password for every seeded account (dev/test only).
const SEED_PASSWORD = 'password-123';

async function upsertUser(
  email: string,
  name: string,
  passwordHash: string,
): Promise<{ id: string; name: string }> {
  return prisma.user.upsert({
    where: { email },
    // Reset name/password even if the account already exists, so the
    // documented seed credentials always work on a dev database.
    update: { name, passwordHash },
    create: { email, passwordHash, name, lifeProfile: { create: {} } },
    select: { id: true, name: true },
  });
}

async function ensurePlaceholder(
  familyId: string,
  displayName: string,
  gender: Gender,
  birthDate: string,
): Promise<{ id: string }> {
  const existing = await prisma.familyMember.findFirst({
    where: { familyId, displayName, userId: null },
    select: { id: true },
  });
  if (existing) {
    return existing;
  }
  return prisma.familyMember.create({
    data: {
      familyId,
      displayName,
      gender,
      placeholderProfile: { create: { birthDate: new Date(birthDate) } },
    },
    select: { id: true },
  });
}

async function ensureRelationship(
  familyId: string,
  fromMemberId: string,
  toMemberId: string,
  type: RelationshipType,
): Promise<void> {
  await prisma.relationship.upsert({
    where: {
      familyId_fromMemberId_toMemberId_type: {
        familyId,
        fromMemberId,
        toMemberId,
        type,
      },
    },
    update: {},
    create: { familyId, fromMemberId, toMemberId, type },
  });
}

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(SEED_PASSWORD);

  const hanako = await upsertUser(
    'hanako@example.com',
    '山田 花子',
    passwordHash,
  );
  const taro = await upsertUser('taro@example.com', '山田 太郎', passwordHash);

  // 山田家 — main demo family: 2 linked members + grandparents as placeholders.
  const yamada = await prisma.family.upsert({
    where: { inviteCode: 'YAMADA22' },
    update: {},
    create: { name: '山田家', inviteCode: 'YAMADA22', createdById: hanako.id },
    select: { id: true },
  });

  const hanakoMember = await prisma.familyMember.upsert({
    where: { familyId_userId: { familyId: yamada.id, userId: hanako.id } },
    update: {},
    create: {
      familyId: yamada.id,
      userId: hanako.id,
      displayName: hanako.name,
    },
    select: { id: true },
  });
  const taroMember = await prisma.familyMember.upsert({
    where: { familyId_userId: { familyId: yamada.id, userId: taro.id } },
    update: {},
    create: { familyId: yamada.id, userId: taro.id, displayName: taro.name },
    select: { id: true },
  });

  const grandpa = await ensurePlaceholder(
    yamada.id,
    '山田 一郎',
    Gender.MALE,
    '1948-05-20',
  );
  const grandma = await ensurePlaceholder(
    yamada.id,
    '山田 春子',
    Gender.FEMALE,
    '1952-11-03',
  );

  await ensureRelationship(
    yamada.id,
    grandpa.id,
    grandma.id,
    RelationshipType.SPOUSE,
  );
  await ensureRelationship(
    yamada.id,
    grandpa.id,
    taroMember.id,
    RelationshipType.PARENT,
  );
  await ensureRelationship(
    yamada.id,
    grandma.id,
    taroMember.id,
    RelationshipType.PARENT,
  );
  await ensureRelationship(
    yamada.id,
    taroMember.id,
    hanakoMember.id,
    RelationshipType.SPOUSE,
  );

  // 鈴木家 — second family so multi-family membership is testable.
  const suzuki = await prisma.family.upsert({
    where: { inviteCode: 'SUZUKI22' },
    update: {},
    create: { name: '鈴木家', inviteCode: 'SUZUKI22', createdById: taro.id },
    select: { id: true },
  });
  await prisma.familyMember.upsert({
    where: { familyId_userId: { familyId: suzuki.id, userId: taro.id } },
    update: {},
    create: { familyId: suzuki.id, userId: taro.id, displayName: taro.name },
  });

  // Sample posts shared to 山田家 — ready for the Post API / home feed (1.5).
  const postContent = '今日はおばあちゃんの誕生日ケーキを作りました🎂';
  const existingPost = await prisma.post.findFirst({
    where: { authorUserId: hanako.id, content: postContent },
    select: { id: true },
  });
  if (!existingPost) {
    await prisma.post.create({
      data: {
        authorUserId: hanako.id,
        type: PostType.POST,
        content: postContent,
        families: { create: { familyId: yamada.id } },
      },
    });
  }
  const eventTitle = '家族旅行（箱根）';
  const existingEvent = await prisma.post.findFirst({
    where: { authorUserId: taro.id, eventTitle },
    select: { id: true },
  });
  if (!existingEvent) {
    await prisma.post.create({
      data: {
        authorUserId: taro.id,
        type: PostType.EVENT,
        eventTitle,
        eventDate: new Date('2026-09-15'),
        content: '秋の家族旅行を計画しています',
        families: { create: { familyId: yamada.id } },
      },
    });
  }

  console.log('Seed complete:', {
    users: await prisma.user.count(),
    families: await prisma.family.count(),
    members: await prisma.familyMember.count(),
    relationships: await prisma.relationship.count(),
    posts: await prisma.post.count(),
  });
  console.log(
    `Logins: hanako@example.com, taro@example.com / ${SEED_PASSWORD}`,
  );
  console.log('Invite codes: YAMADA22 (山田家), SUZUKI22 (鈴木家)');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

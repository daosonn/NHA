import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  Gender,
  PostType,
  RelationshipType,
} from '../src/generated/prisma/enums';
import { materialiseSeedImages, type SeedImage } from './seed-images';

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

interface PostSeed {
  type: PostType;
  content?: string;
  eventTitle?: string;
  eventDate?: Date;
  place?: string;
}

async function ensurePost(
  authorUserId: string,
  familyId: string,
  seed: PostSeed,
): Promise<{ id: string }> {
  const existing = await prisma.post.findFirst({
    where: seed.eventTitle
      ? { authorUserId, eventTitle: seed.eventTitle }
      : { authorUserId, content: seed.content },
    select: { id: true },
  });
  if (existing) {
    return existing;
  }
  return prisma.post.create({
    data: { authorUserId, ...seed, families: { create: { familyId } } },
    select: { id: true },
  });
}

/**
 * Media rows are shared through the database; the files behind them are not
 * (see seed-images.ts). Matching on storageKey means the row survives a
 * re-seed on another machine, where the same slot now holds a different
 * photo — only the size has to catch up.
 */
async function ensureMedia(
  image: SeedImage,
  uploaderUserId: string,
  postId: string,
): Promise<{ id: string }> {
  const existing = await prisma.media.findFirst({
    where: { storageKey: image.storageKey },
    select: { id: true },
  });
  if (existing) {
    await prisma.media.update({
      where: { id: existing.id },
      data: { mimeType: image.mimeType, sizeBytes: image.sizeBytes, postId },
    });
    return existing;
  }
  return prisma.media.create({
    data: { ...image, uploaderUserId, postId },
    select: { id: true },
  });
}

async function ensureLifeEvent(
  profileId: string,
  createdById: string,
  event: {
    title: string;
    eventDate: string;
    place?: string;
    description?: string;
  },
): Promise<void> {
  const existing = await prisma.lifeEvent.findFirst({
    where: { profileId, title: event.title },
    select: { id: true },
  });
  if (existing) {
    return;
  }
  await prisma.lifeEvent.create({
    data: {
      profileId,
      createdById,
      title: event.title,
      eventDate: new Date(event.eventDate),
      place: event.place,
      description: event.description,
    },
  });
}

async function ensureAlbum(
  ownerUserId: string,
  name: string,
  description: string,
  mediaIds: string[],
): Promise<void> {
  if (mediaIds.length === 0) {
    return;
  }
  const existing = await prisma.album.findFirst({
    where: { ownerUserId, name },
    select: { id: true },
  });
  const album =
    existing ??
    (await prisma.album.create({
      data: { ownerUserId, name, description, coverMediaId: mediaIds[0] },
      select: { id: true },
    }));
  for (const mediaId of mediaIds) {
    await prisma.albumItem.upsert({
      where: { albumId_mediaId: { albumId: album.id, mediaId } },
      update: {},
      create: { albumId: album.id, mediaId },
    });
  }
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
  const cakePost = await ensurePost(hanako.id, yamada.id, {
    type: PostType.POST,
    content: '今日はおばあちゃんの誕生日ケーキを作りました🎂',
  });
  const hakonePost = await ensurePost(taro.id, yamada.id, {
    type: PostType.EVENT,
    eventTitle: '家族旅行（箱根）',
    eventDate: new Date('2026-09-15'),
    content: '秋の家族旅行を計画しています',
    place: '神奈川県箱根町',
  });
  const gardenPost = await ensurePost(hanako.id, yamada.id, {
    type: PostType.POST,
    content: '庭のあじさいが咲きました。母が植えた株です。',
  });
  const newYearPost = await ensurePost(taro.id, yamada.id, {
    type: PostType.EVENT,
    eventTitle: 'お正月（実家）',
    eventDate: new Date('2026-01-02'),
    content: '久しぶりに全員そろいました',
    place: '静岡県三島市',
  });

  // Life profiles — the profile screen looks empty without these.
  await prisma.lifeProfile.update({
    where: { userId: hanako.id },
    data: {
      bio: '写真と料理が好きです。家族の記録を少しずつ残しています。',
      birthDate: new Date('1990-04-12'),
      birthPlace: '東京都世田谷区',
      occupation: 'グラフィックデザイナー',
      interests: ['料理', '写真', '園芸'],
      updatedById: hanako.id,
    },
  });
  await prisma.lifeProfile.update({
    where: { userId: taro.id },
    data: {
      bio: '山登りと将棋。週末は子どもと近所の川へ。',
      birthDate: new Date('1988-08-30'),
      birthPlace: '静岡県三島市',
      occupation: '建築士',
      interests: ['登山', '将棋', 'カメラ'],
      updatedById: taro.id,
    },
  });

  const hanakoProfile = await prisma.lifeProfile.findUniqueOrThrow({
    where: { userId: hanako.id },
    select: { id: true },
  });
  const grandpaProfile = await prisma.lifeProfile.findUnique({
    where: { memberId: grandpa.id },
    select: { id: true },
  });

  // A timeline needs more than one point to read as a timeline.
  await ensureLifeEvent(hanakoProfile.id, hanako.id, {
    title: '大学卒業',
    eventDate: '2013-03-25',
    place: '東京都',
  });
  await ensureLifeEvent(hanakoProfile.id, hanako.id, {
    title: '結婚',
    eventDate: '2017-10-08',
    place: '東京都渋谷区',
    description: '小さな式を家族だけで',
  });
  await ensureLifeEvent(hanakoProfile.id, hanako.id, {
    title: '長男が生まれる',
    eventDate: '2020-06-14',
  });
  if (grandpaProfile) {
    await ensureLifeEvent(grandpaProfile.id, hanako.id, {
      title: '工務店を開業',
      eventDate: '1975-04-01',
      place: '静岡県三島市',
      description: '祖父が一人で始めた店。今の家もここで建てた。',
    });
    await ensureLifeEvent(grandpaProfile.id, hanako.id, {
      title: '金婚式',
      eventDate: '2023-11-03',
    });
  }

  // Photos: files first (per machine), then the rows that point at them.
  const images = await materialiseSeedImages();
  const mediaIds: string[] = [];
  const postsForPhotos = [cakePost, hakonePost, gardenPost, newYearPost];
  for (const [index, image] of images.entries()) {
    // Two photos per post, in order, so the first posts are never empty.
    const target =
      postsForPhotos[Math.floor(index / 2) % postsForPhotos.length];
    const media = await ensureMedia(image, hanako.id, target.id);
    mediaIds.push(media.id);
  }

  await ensureAlbum(
    hanako.id,
    '家族のアルバム',
    '山田家のふだんの写真',
    mediaIds,
  );

  console.log('Seed complete:', {
    users: await prisma.user.count(),
    families: await prisma.family.count(),
    members: await prisma.familyMember.count(),
    relationships: await prisma.relationship.count(),
    posts: await prisma.post.count(),
    lifeEvents: await prisma.lifeEvent.count(),
    media: await prisma.media.count(),
    albums: await prisma.album.count(),
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

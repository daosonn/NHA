/**
 * E2E màn 13b: PATCH /families/:id (tên/địa chỉ/giới thiệu/bìa) + rời nhà.
 * DB LOCAL (DATABASE_URL của apps/api/.env khi test) — không bao giờ Neon.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';

jest.setTimeout(120_000);

async function json<T>(req: request.Test, status: number): Promise<T> {
  const res = await req.expect(status);
  return res.body as T;
}

type AuthBody = { accessToken: string };
type IdBody = { id: string };
type FamilyPatched = {
  id: string;
  name: string;
  coverMediaId: string | null;
  address: string | null;
  about: string | null;
};
type FamilyDetail = {
  inviteCode: string;
  address: string | null;
  about: string | null;
  coverMediaId: string | null;
  members: { id: string; userId: string | null }[];
};

describe('Family edit (13b) + leave', () => {
  let app: INestApplication<App>;
  let http: App;
  let tokenA = '';
  let tokenB = '';
  let userBId = '';
  let familyId = '';
  const stamp = Date.now();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    http = app.getHttpServer();

    tokenA = (
      await json<AuthBody>(
        request(http)
          .post('/api/auth/register')
          .send({
            email: `famedit_a_${stamp}@example.com`,
            password: 'password-123',
            name: 'Edit A',
          }),
        201,
      )
    ).accessToken;
    tokenB = (
      await json<AuthBody>(
        request(http)
          .post('/api/auth/register')
          .send({
            email: `famedit_b_${stamp}@example.com`,
            password: 'password-123',
            name: 'Edit B',
          }),
        201,
      )
    ).accessToken;
    familyId = (
      await json<IdBody>(
        request(http)
          .post('/api/families')
          .set(as(tokenA))
          .send({ name: 'Edit Fam' }),
        201,
      )
    ).id;
    const before = await json<FamilyDetail>(
      request(http).get(`/api/families/${familyId}`).set(as(tokenA)),
      200,
    );
    await json(
      request(http)
        .post('/api/families/join')
        .set(as(tokenB))
        .send({ inviteCode: before.inviteCode }),
      200,
    );
    // B là member liên-kết duy nhất không có mặt trước khi join.
    const after = await json<FamilyDetail>(
      request(http).get(`/api/families/${familyId}`).set(as(tokenA)),
      200,
    );
    const existing = new Set(before.members.map((m) => m.id));
    userBId =
      after.members.find((m) => !existing.has(m.id) && m.userId !== null)
        ?.userId ?? '';
  });

  afterAll(async () => {
    await app.close();
  });

  const as = (token: string) => ({ authorization: `Bearer ${token}` });

  it('any member edits name/address/about; blanks clear; {} is a 400', async () => {
    // B (không phải người tạo) sửa được — wiki rule
    const patched = await json<FamilyPatched>(
      request(http).patch(`/api/families/${familyId}`).set(as(tokenB)).send({
        name: 'ヴァン家',
        address: 'Hanoi, Vietnam',
        about: 'Four generations in the same lane.',
      }),
      200,
    );
    expect(patched.name).toBe('ヴァン家');
    expect(patched.address).toBe('Hanoi, Vietnam');

    // chuỗi rỗng xoá field
    const cleared = await json<FamilyPatched>(
      request(http)
        .patch(`/api/families/${familyId}`)
        .set(as(tokenA))
        .send({ about: '' }),
      200,
    );
    expect(cleared.about).toBeNull();
    expect(cleared.address).toBe('Hanoi, Vietnam'); // field không gửi giữ nguyên

    await request(http)
      .patch(`/api/families/${familyId}`)
      .set(as(tokenA))
      .send({})
      .expect(400);
    await request(http)
      .patch(`/api/families/${familyId}`)
      .set(as(tokenA))
      .send({ name: '   ' })
      .expect(400);
  });

  it('cover: own upload works and the other member may view it (canView branch)', async () => {
    const buf = await sharp({
      create: { width: 600, height: 600, channels: 3, background: '#7a9e7e' },
    })
      .jpeg()
      .toBuffer();
    const media = await json<IdBody>(
      request(http).post('/api/media').set(as(tokenA)).attach('file', buf, {
        filename: 'cover.jpg',
        contentType: 'image/jpeg',
      }),
      201,
    );
    const patched = await json<FamilyPatched>(
      request(http)
        .patch(`/api/families/${familyId}`)
        .set(as(tokenA))
        .send({ coverMediaId: media.id }),
      200,
    );
    expect(patched.coverMediaId).toBe(media.id);
    // B xem được ảnh orphan của A vì nó là bìa nhà chung (luật mới)
    await request(http)
      .get(`/api/media/${media.id}`)
      .set(as(tokenB))
      .expect(200);
    // B KHÔNG đặt lại được ảnh riêng của A làm bìa (không phải của B, không từ post chung)
    await request(http)
      .patch(`/api/families/${familyId}`)
      .set(as(tokenB))
      .send({ coverMediaId: media.id })
      .expect(404);
  });

  it('leave: B removes their own member row; A cannot remove B', async () => {
    const detail = await json<FamilyDetail>(
      request(http).get(`/api/families/${familyId}`).set(as(tokenA)),
      200,
    );
    const memberB = detail.members.find((m) => m.userId === userBId);
    expect(memberB).toBeDefined();
    // A đá B → 403 (linked member chỉ tự rời)
    await request(http)
      .delete(`/api/families/${familyId}/members/${memberB!.id}`)
      .set(as(tokenA))
      .expect(403);
    // B tự rời → 200, và list families của B không còn nhà này
    await json(
      request(http)
        .delete(`/api/families/${familyId}/members/${memberB!.id}`)
        .set(as(tokenB)),
      200,
    );
    const bFamilies = await json<IdBody[]>(
      request(http).get('/api/families').set(as(tokenB)),
      200,
    );
    expect(bFamilies.some((f) => f.id === familyId)).toBe(false);
  });
});

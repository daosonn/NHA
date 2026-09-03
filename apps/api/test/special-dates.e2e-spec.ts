/**
 * E2E "Dates we keep" (màn 12a–12d): CRUD ngày của nhà (âm lịch, một lần,
 * lead nhắc riêng), ngày cá nhân "Only me" (riêng tư như memo), và feed tổng
 * hợp /me/special-dates với filter theo nhà / theo scope.
 *
 * Yêu cầu môi trường: PostgreSQL LOCAL đang chạy (DATABASE_URL của
 * apps/api/.env khi test — KHÔNG BAO GIỜ trỏ Neon). Không cần AI service.
 * Chạy: pnpm --filter api test:e2e
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { convertLunar2Solar } from '../src/common/lunar';

jest.setTimeout(120_000);

async function json<T>(req: request.Test, status: number): Promise<T> {
  const res = await req.expect(status);
  return res.body as T;
}

type AuthBody = { accessToken: string };
type IdBody = { id: string };
type FamilyDetail = { id: string; inviteCode: string };
type Detail = {
  id: string;
  scope: 'FAMILY' | 'PERSONAL';
  familyId: string | null;
  type: string;
  title: string;
  month: number;
  day: number;
  isLunar: boolean;
  repeatsYearly: boolean;
  year: number | null;
  remindDaysBefore: number;
  nextOccurrence: string | null;
  daysUntil: number | null;
  members: { memberId: string }[];
};
type Item = {
  source: 'DERIVED' | 'CUSTOM';
  id: string | null;
  scope: 'FAMILY' | 'PERSONAL';
  familyId: string | null;
  familyName: string | null;
  type: string;
  isLunar: boolean;
  repeatsYearly: boolean;
  nextOccurrence: string;
  daysUntil: number;
  members: { memberId: string }[];
};
type Upcoming = { items: Item[] };

function iso(d: { day: number; month: number; year: number }): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(
    d.day,
  ).padStart(2, '0')}`;
}

describe('Special dates v2 (Dates we keep, 12a-12d)', () => {
  let app: INestApplication<App>;
  let http: App;
  let tokenA = '';
  let tokenB = '';
  let f1 = ''; // A + B
  let f2 = ''; // chỉ A
  let f3 = ''; // chỉ B
  let grandmaF1 = ''; // placeholder có birthDate → DERIVED
  let memberF2 = ''; // placeholder bên F2 — gắn vào ngày cá nhân của A
  let memberF3 = ''; // placeholder của B — A không được gắn
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
  });

  afterAll(async () => {
    await app.close();
  });

  const as = (token: string) => ({ authorization: `Bearer ${token}` });

  it('setup: 2 users, 3 families, members with profile dates', async () => {
    tokenA = (
      await json<AuthBody>(
        request(http)
          .post('/api/auth/register')
          .send({
            email: `dates_a_${stamp}@example.com`,
            password: 'password-123',
            name: 'Dates A',
          }),
        201,
      )
    ).accessToken;
    tokenB = (
      await json<AuthBody>(
        request(http)
          .post('/api/auth/register')
          .send({
            email: `dates_b_${stamp}@example.com`,
            password: 'password-123',
            name: 'Dates B',
          }),
        201,
      )
    ).accessToken;

    f1 = (
      await json<IdBody>(
        request(http)
          .post('/api/families')
          .set(as(tokenA))
          .send({ name: 'Dates F1' }),
        201,
      )
    ).id;
    f2 = (
      await json<IdBody>(
        request(http)
          .post('/api/families')
          .set(as(tokenA))
          .send({ name: 'Dates F2' }),
        201,
      )
    ).id;
    f3 = (
      await json<IdBody>(
        request(http)
          .post('/api/families')
          .set(as(tokenB))
          .send({ name: 'Dates F3' }),
        201,
      )
    ).id;

    // B vào F1 bằng mã mời.
    const detail = await json<FamilyDetail>(
      request(http).get(`/api/families/${f1}`).set(as(tokenA)),
      200,
    );
    await json(
      request(http)
        .post('/api/families/join')
        .set(as(tokenB))
        .send({ inviteCode: detail.inviteCode }),
      200, // join là idempotent-ish nên controller trả 200, không phải 201
    );

    grandmaF1 = (
      await json<IdBody>(
        request(http)
          .post(`/api/families/${f1}/members`)
          .set(as(tokenA))
          .send({ displayName: 'Grandma Dates' }),
        201,
      )
    ).id;
    // birthDate → widget sinh DERIVED BIRTHDAY (id null)
    await json(
      request(http)
        .patch(`/api/families/${f1}/members/${grandmaF1}/profile`)
        .set(as(tokenA))
        .send({ birthDate: '1956-03-22' }),
      200,
    );

    memberF2 = (
      await json<IdBody>(
        request(http)
          .post(`/api/families/${f2}/members`)
          .set(as(tokenA))
          .send({ displayName: 'Grandpa F2' }),
        201,
      )
    ).id;
    memberF3 = (
      await json<IdBody>(
        request(http)
          .post(`/api/families/${f3}/members`)
          .set(as(tokenB))
          .send({ displayName: 'Stranger F3' }),
        201,
      )
    ).id;
  });

  let tetId = '';
  let gioId = '';
  let milestoneId = '';

  it('family CRUD: lunar Tết, lunar giỗ with its own lead, one-off milestone', async () => {
    const tet = await json<Detail>(
      request(http)
        .post(`/api/families/${f1}/special-dates`)
        .set(as(tokenA))
        .send({
          type: 'TET',
          title: 'Tết with the whole family',
          month: 1,
          day: 1,
          isLunar: true,
          remindDaysBefore: 3,
          theme: 'BUNTING',
        }),
      201,
    );
    tetId = tet.id;
    expect(tet.isLunar).toBe(true);
    expect(tet.repeatsYearly).toBe(true);
    expect(tet.remindDaysBefore).toBe(3);
    expect(tet.scope).toBe('FAMILY');
    // nextOccurrence phải là ngày DƯƠNG do server đổi — khớp bộ đổi lịch.
    expect(tet.nextOccurrence).not.toBeNull();
    const [y] = tet.nextOccurrence!.split('-').map(Number);
    const expected = convertLunar2Solar(1, 1, y, false);
    // Tết của năm dương y nằm trong năm âm y (tháng 1 âm luôn rơi T1-T2 dương)
    expect(tet.nextOccurrence).toBe(iso(expected!));

    const gio = await json<Detail>(
      request(http)
        .post(`/api/families/${f1}/special-dates`)
        .set(as(tokenA))
        .send({
          type: 'MEMORIAL',
          title: "Grandpa's memorial",
          month: 10,
          day: 2,
          isLunar: true,
          remindDaysBefore: 10,
          theme: 'FLORAL_BORDER',
          memberIds: [grandmaF1],
        }),
      201,
    );
    gioId = gio.id;
    expect(gio.remindDaysBefore).toBe(10);
    expect(gio.members.map((m) => m.memberId)).toEqual([grandmaF1]);

    const milestone = await json<Detail>(
      request(http)
        .post(`/api/families/${f1}/special-dates`)
        .set(as(tokenA))
        .send({
          type: 'MILESTONE',
          title: 'Linh graduates',
          month: 5,
          day: 19,
          repeatsYearly: false,
          year: 2100, // xa hẳn để không bao giờ "đã qua" trong test
          theme: 'BUNTING',
        }),
      201,
    );
    milestoneId = milestone.id;
    expect(milestone.repeatsYearly).toBe(false);
    expect(milestone.year).toBe(2100);
    expect(milestone.nextOccurrence).toBe('2100-05-19');
  });

  it('validation 400s: the shapes that must never reach the table', async () => {
    const base = { title: 'x', theme: 'BUNTING' };
    // lunar day 31
    await request(http)
      .post(`/api/families/${f1}/special-dates`)
      .set(as(tokenA))
      .send({ ...base, type: 'CUSTOM', month: 1, day: 31, isLunar: true })
      .expect(400);
    // một lần thiếu năm
    await request(http)
      .post(`/api/families/${f1}/special-dates`)
      .set(as(tokenA))
      .send({
        ...base,
        type: 'MILESTONE',
        month: 5,
        day: 19,
        repeatsYearly: false,
      })
      .expect(400);
    // lead vượt trần
    await request(http)
      .post(`/api/families/${f1}/special-dates`)
      .set(as(tokenA))
      .send({
        ...base,
        type: 'CUSTOM',
        month: 5,
        day: 19,
        remindDaysBefore: 31,
      })
      .expect(400);
    // Feb 29 một-lần ở năm thường là nói dối, không phải ngày
    await request(http)
      .post(`/api/families/${f1}/special-dates`)
      .set(as(tokenA))
      .send({
        ...base,
        type: 'CUSTOM',
        month: 2,
        day: 29,
        repeatsYearly: false,
        year: 2027,
      })
      .expect(400);
    // Feb 29 LẶP hằng năm vẫn hợp lệ (trôi tới 1/3 lúc hiển thị) — hành vi cũ
    const feb29 = await json<Detail>(
      request(http)
        .post(`/api/families/${f1}/special-dates`)
        .set(as(tokenA))
        .send({ ...base, type: 'CUSTOM', month: 2, day: 29 }),
      201,
    );
    await request(http)
      .delete(`/api/families/${f1}/special-dates/${feb29.id}`)
      .set(as(tokenA))
      .expect(200);
    // PATCH chỉ đổi month không được để lại 31/2
    await request(http)
      .patch(`/api/families/${f1}/special-dates/${milestoneId}`)
      .set(as(tokenA))
      .send({ month: 2, day: 31 })
      .expect(400);
  });

  it('per-family GET: derived rows carry id null, custom rows their id', async () => {
    const { items } = await json<Upcoming>(
      request(http)
        .get(`/api/families/${f1}/special-dates?limit=50`)
        .set(as(tokenA)),
      200,
    );
    const derived = items.filter((i) => i.source === 'DERIVED');
    const custom = items.filter((i) => i.source === 'CUSTOM');
    expect(derived.length).toBeGreaterThanOrEqual(1); // sinh nhật Grandma
    expect(derived.every((i) => i.id === null)).toBe(true);
    expect(custom.some((i) => i.id === tetId)).toBe(true);
    expect(items.every((i) => i.scope === 'FAMILY')).toBe(true);
    expect(items.every((i) => i.familyName === 'Dates F1')).toBe(true);
    // sort soonest-first
    const days = items.map((i) => i.daysUntil);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });

  let personalId = '';

  it('personal ("Only me"): private like a memo, members from any of MY families', async () => {
    const personal = await json<Detail>(
      request(http)
        .post('/api/me/special-dates')
        .set(as(tokenA))
        .send({
          type: 'ANNIVERSARY',
          title: 'Private anniversary',
          month: 9,
          day: 15,
          remindDaysBefore: 14,
          theme: 'BUNTING',
          memberIds: [memberF2], // người của F2 — nhà khác của CHÍNH A
        }),
      201,
    );
    personalId = personal.id;
    expect(personal.scope).toBe('PERSONAL');
    expect(personal.familyId).toBeNull();

    // B không bao giờ thấy nó — kể cả biết id (404, không phải 403)
    const bAggregate = await json<Upcoming>(
      request(http).get('/api/me/special-dates?limit=50').set(as(tokenB)),
      200,
    );
    expect(bAggregate.items.some((i) => i.id === personalId)).toBe(false);
    await request(http)
      .get(`/api/me/special-dates/${personalId}`)
      .set(as(tokenB))
      .expect(404);

    // A sửa/xoá được của mình
    const patched = await json<Detail>(
      request(http)
        .patch(`/api/me/special-dates/${personalId}`)
        .set(as(tokenA))
        .send({ remindDaysBefore: 7 }),
      200,
    );
    expect(patched.remindDaysBefore).toBe(7);

    // gắn người từ nhà A KHÔNG thuộc về (F3 của B) → 400
    await request(http)
      .post('/api/me/special-dates')
      .set(as(tokenA))
      .send({
        type: 'CUSTOM',
        title: 'bad member',
        month: 1,
        day: 1,
        theme: 'BUNTING',
        memberIds: [memberF3],
      })
      .expect(400);
  });

  it('aggregate /me/special-dates: spans families + personal, filters narrow', async () => {
    const all = await json<Upcoming>(
      request(http).get('/api/me/special-dates?limit=50').set(as(tokenA)),
      200,
    );
    const families = new Set(all.items.map((i) => i.familyId));
    expect(families.has(f1)).toBe(true);
    expect(all.items.some((i) => i.id === personalId)).toBe(true);
    // sort soonest-first xuyên nguồn
    const days = all.items.map((i) => i.daysUntil);
    expect([...days].sort((a, b) => a - b)).toEqual(days);

    const onlyF1 = await json<Upcoming>(
      request(http)
        .get(`/api/me/special-dates?familyId=${f1}&limit=50`)
        .set(as(tokenA)),
      200,
    );
    expect(onlyF1.items.every((i) => i.familyId === f1)).toBe(true);
    expect(onlyF1.items.some((i) => i.id === personalId)).toBe(false);

    const onlyMine = await json<Upcoming>(
      request(http)
        .get('/api/me/special-dates?scope=PERSONAL&limit=50')
        .set(as(tokenA)),
      200,
    );
    expect(onlyMine.items.every((i) => i.scope === 'PERSONAL')).toBe(true);
    expect(onlyMine.items.some((i) => i.id === personalId)).toBe(true);

    // filter sang nhà mình không thuộc về → 403 (lỗi caller, không im lặng)
    await request(http)
      .get(`/api/me/special-dates?familyId=${f2}`)
      .set(as(tokenB))
      .expect(403);
  });

  it("route regression: 'custom' is not eaten by ':specialDateId'", async () => {
    const familyCustom = await json<Detail[]>(
      request(http)
        .get(`/api/families/${f1}/special-dates/custom`)
        .set(as(tokenA)),
      200,
    );
    expect(Array.isArray(familyCustom)).toBe(true);
    expect(familyCustom.some((d) => d.id === gioId)).toBe(true);

    const myCustom = await json<Detail[]>(
      request(http).get('/api/me/special-dates/custom').set(as(tokenA)),
      200,
    );
    expect(myCustom.some((d) => d.id === personalId)).toBe(true);

    // GET-one của nhà: 404 khi xin qua nhà khác
    await request(http)
      .get(`/api/families/${f2}/special-dates/${gioId}`)
      .set(as(tokenA))
      .expect(404);
    const one = await json<Detail>(
      request(http)
        .get(`/api/families/${f1}/special-dates/${gioId}`)
        .set(as(tokenA)),
      200,
    );
    expect(one.isLunar).toBe(true);
  });
});

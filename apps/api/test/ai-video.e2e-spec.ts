/**
 * E2E khu AI (màn 21-33): auth → family → media → post → gift/message (AI mock) →
 * card PNG → storyboard → video job render THẬT bằng ffmpeg → share về feed → quick mode.
 *
 * Yêu cầu môi trường (giống dev thật):
 *  - PostgreSQL đang chạy (DATABASE_URL của apps/api/.env)
 *  - AI service (apps/ai) đang chạy ở AI_SERVICE_URL với AI_MOCK=1  →  0 token
 * Chạy: pnpm --filter api test:e2e   (jest-e2e.json — timeout dài vì có render video thật)
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';

jest.setTimeout(600_000); // render ffmpeg thật

describe('AI + Video (screens 21-33)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let token = '';
  let familyId = '';
  let memberId = '';
  const mediaIds: string[] = [];
  const email = `e2e_${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => ({ authorization: `Bearer ${token}` });

  it('registers a user and creates a family with a second member', async () => {
    const reg = await request(http)
      .post('/api/auth/register')
      .send({ email, password: 'password-123', name: 'E2E Tester' })
      .expect(201);
    token = reg.body.accessToken;

    const fam = await request(http)
      .post('/api/families')
      .set(auth())
      .send({ name: 'E2E Family' })
      .expect(201);
    familyId = fam.body.id;

    const member = await request(http)
      .post(`/api/families/${familyId}/members`)
      .set(auth())
      .send({ displayName: 'Grandma E2E' })
      .expect(201);
    memberId = member.body.id;
  });

  it('uploads media and posts a tagged moment (the evidence)', async () => {
    for (const color of ['#7a9e7e', '#b3785e', '#5e7ab3']) {
      const buf = await sharp({ create: { width: 1000, height: 750, channels: 3, background: color } })
        .jpeg()
        .toBuffer();
      const up = await request(http)
        .post('/api/media')
        .set(auth())
        .attach('file', buf, { filename: 'e2e.jpg', contentType: 'image/jpeg' })
        .expect(201);
      mediaIds.push(up.body.id);
    }
    expect(mediaIds).toHaveLength(3);

    await request(http)
      .post('/api/posts')
      .set(auth())
      .send({
        type: 'POST',
        content: 'Sáng nào bà cũng ra vườn tưới mấy chậu lan.',
        familyIds: [familyId],
        taggedMemberIds: [memberId],
        mediaIds,
      })
      .expect(201);
  });

  it('screen 21→22: gift ideas are grounded, carry provenance and honour the saved list', async () => {
    const res = await request(http)
      .post(`/api/families/${familyId}/members/${memberId}/gift-ideas`)
      .set(auth())
      .send({ occasionLabel: 'Birthday', budgetLabel: '3.000〜8.000円' })
      .expect(201);
    expect(res.body.ideas.length).toBeGreaterThanOrEqual(1);
    expect(res.body.evidence_read.photos).toBeGreaterThanOrEqual(1);
    // provenance: mọi source phải trỏ về dữ liệu thật — memo, hoặc signal trong hồ sơ
    // đã chưng cất (sig_…, lần được về bài gốc qua GET …/evidence)
    for (const idea of res.body.ideas) {
      for (const s of idea.sources) expect(s.evidence_id).toMatch(/^(memo|post|sig)_/);
    }

    await request(http)
      .post(`/api/families/${familyId}/members/${memberId}/gift-ideas/save`)
      .set(auth())
      .send({ title: 'A garden set' })
      .expect(201);
    const saved = await request(http)
      .get(`/api/families/${familyId}/members/${memberId}/gift-ideas/saved`)
      .set(auth())
      .expect(200);
    expect(saved.body.some((s: { title: string }) => s.title === 'A garden set')).toBe(true);
  });

  it('screens 24-25: three message variants in order', async () => {
    const res = await request(http)
      .post(`/api/families/${familyId}/members/${memberId}/message-suggestions`)
      .set(auth())
      .send({ occasionLabel: 'Birthday', extraNote: 'I cannot come home this year' })
      .expect(201);
    expect(res.body.variants.map((v: { length: string }) => v.length)).toEqual([
      'short',
      'standard',
      'heartfelt',
    ]);
  });

  it('screen 26: renders a card PNG and returns a viewable media id', async () => {
    const res = await request(http)
      .post(`/api/families/${familyId}/cards`)
      .set(auth())
      .send({ template: 'marigold', message: 'Happy birthday!', toName: 'Grandma', fromName: 'E2E', heading: 'BIRTHDAY' })
      .expect(201);
    expect(res.body.media_id).toBeTruthy();
    await request(http).get(`/api/media/${res.body.media_id}`).set(auth()).expect(200);
  });

  it('screens 27-33: storyboard → AI-mode job renders a real mp4, streams and shares to the feed', async () => {
    const sb = await request(http)
      .post(`/api/families/${familyId}/video-jobs/storyboard`)
      .set(auth())
      .send({ memberId, mediaIds, targetSec: 30, mood: 'warm', locale: 'ja' })
      .expect(201);
    expect(sb.body.scenes).toHaveLength(3);

    const job = await request(http)
      .post(`/api/families/${familyId}/video-jobs`)
      .set(auth())
      .send({
        memberId,
        mediaIds,
        mode: 'ai',
        targetSec: 30,
        aspect: 'portrait',
        style: 'cinema',
        musicId: 'canon',
        plan: {
          title: sb.body.title,
          subtitle: sb.body.subtitle,
          opening: sb.body.opening,
          closing: sb.body.closing,
          dedication: sb.body.dedication,
          palette: sb.body.palette,
          scenes: sb.body.scenes.map((s: { media_id: string; duration_s: number; caption: string }) => ({
            mediaId: s.media_id,
            durationS: s.duration_s,
            caption: s.caption,
          })),
        },
      })
      .expect(201);

    await request(http).post(`/api/video-jobs/${job.body.id}/render`).set(auth()).expect(201);

    let status = 'PROCESSING';
    let done: Record<string, unknown> = {};
    for (let i = 0; i < 200 && status !== 'DONE' && status !== 'FAILED'; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const st = await request(http).get(`/api/video-jobs/${job.body.id}`).set(auth()).expect(200);
      status = st.body.status;
      done = st.body;
    }
    expect(status).toBe('DONE');
    expect(Number(done.duration_s)).toBeGreaterThan(5);

    await request(http)
      .get(`/api/video-jobs/${job.body.id}/file`)
      .set({ ...auth(), range: 'bytes=0-99' })
      .expect(206);

    const share = await request(http)
      .post(`/api/video-jobs/${job.body.id}/share`)
      .set(auth())
      .send({ caption: 'E2E memory video' })
      .expect(201);
    const feed = await request(http).get(`/api/families/${familyId}/posts`).set(auth()).expect(200);
    expect(JSON.stringify(feed.body)).toContain(share.body.post_id);
  });

  it('quick mode renders with no AI and no cards', async () => {
    const job = await request(http)
      .post(`/api/families/${familyId}/video-jobs`)
      .set(auth())
      .send({ mediaIds, mode: 'quick', musicId: 'twinkle' })
      .expect(201);
    await request(http).post(`/api/video-jobs/${job.body.id}/render`).set(auth()).expect(201);

    let status = 'PROCESSING';
    for (let i = 0; i < 120 && status !== 'DONE' && status !== 'FAILED'; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const st = await request(http).get(`/api/video-jobs/${job.body.id}`).set(auth()).expect(200);
      status = st.body.status;
    }
    expect(status).toBe('DONE');
  });
});

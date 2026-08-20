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
import { App } from 'supertest/types';
import sharp from 'sharp';
import { AppModule } from '../src/app.module';

jest.setTimeout(600_000); // render ffmpeg thật

/**
 * supertest khai `res.body` là `any`, nên mọi assertion trên nó mất kiểm tra kiểu.
 * Dồn hết qua helper này để test vẫn được typecheck — sai tên field là lỗi biên
 * dịch, không phải một `undefined` lặng lẽ làm assertion luôn đúng.
 */
async function json<T>(req: request.Test, status: number): Promise<T> {
  const res = await req.expect(status);
  return res.body as T;
}

type IdBody = { id: string };
type AuthBody = { accessToken: string };
type Source = { evidence_id: string; label: string };
type GiftBody = {
  ideas: { title: string; sources: Source[] }[];
  evidence_read: { notes: number; photos: number; past_gifts: number };
  note_to_giver: string | null;
};
type MessageBody = { variants: { length: string; text: string }[] };
type CardBody = { media_id: string };
type StoryboardBody = {
  title: string;
  subtitle: string;
  opening: string;
  closing: string;
  dedication: string;
  palette: Record<string, string>;
  scenes: { media_id: string; duration_s: number; caption: string }[];
};
type JobBody = { id: string; status: string; duration_s: number | null };
type ShareBody = { post_id: string };

describe('AI + Video (screens 21-33)', () => {
  // INestApplication<App>: getHttpServer() trả kiểu supertest hiểu được, nhờ đó
  // mọi request trong file này vẫn được typecheck thay vì rơi về `any`.
  let app: INestApplication<App>;
  let http: App;
  let token = '';
  let familyId = '';
  let memberId = '';
  const mediaIds: string[] = [];
  const email = `e2e_${Date.now()}@example.com`;

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

  const auth = () => ({ authorization: `Bearer ${token}` });

  it('registers a user and creates a family with a second member', async () => {
    const reg = await json<AuthBody>(
      request(http)
        .post('/api/auth/register')
        .send({ email, password: 'password-123', name: 'E2E Tester' }),
      201,
    );
    token = reg.accessToken;

    const fam = await json<IdBody>(
      request(http)
        .post('/api/families')
        .set(auth())
        .send({ name: 'E2E Family' }),
      201,
    );
    familyId = fam.id;

    const member = await json<IdBody>(
      request(http)
        .post(`/api/families/${familyId}/members`)
        .set(auth())
        .send({ displayName: 'Grandma E2E' }),
      201,
    );
    memberId = member.id;
  });

  it('uploads media and posts a tagged moment (the evidence)', async () => {
    for (const color of ['#7a9e7e', '#b3785e', '#5e7ab3']) {
      const buf = await sharp({
        create: { width: 1000, height: 750, channels: 3, background: color },
      })
        .jpeg()
        .toBuffer();
      const up = await json<IdBody>(
        request(http).post('/api/media').set(auth()).attach('file', buf, {
          filename: 'e2e.jpg',
          contentType: 'image/jpeg',
        }),
        201,
      );
      mediaIds.push(up.id);
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
    const gift = await json<GiftBody>(
      request(http)
        .post(`/api/families/${familyId}/members/${memberId}/gift-ideas`)
        .set(auth())
        .send({ occasionLabel: 'Birthday', budgetLabel: '3.000〜8.000円' }),
      201,
    );
    expect(gift.ideas.length).toBeGreaterThanOrEqual(1);
    expect(gift.evidence_read.photos).toBeGreaterThanOrEqual(1);
    // "Lưu ý cho người tặng" luôn phải có — không có gì cần tránh cũng phải nói ra
    expect(gift.note_to_giver?.trim()).toBeTruthy();
    // provenance: mọi source phải trỏ về dữ liệu thật — memo, hoặc signal trong hồ sơ
    // đã chưng cất (sig_…, lần được về bài gốc qua GET …/evidence)
    for (const idea of gift.ideas) {
      for (const s of idea.sources)
        expect(s.evidence_id).toMatch(/^(memo|post|sig)_/);
    }

    await request(http)
      .post(`/api/families/${familyId}/members/${memberId}/gift-ideas/save`)
      .set(auth())
      .send({ title: 'A garden set' })
      .expect(201);
    const saved = await json<{ title: string }[]>(
      request(http)
        .get(`/api/families/${familyId}/members/${memberId}/gift-ideas/saved`)
        .set(auth()),
      200,
    );
    expect(saved.some((s) => s.title === 'A garden set')).toBe(true);
  });

  it('screens 24-25: three message variants in order', async () => {
    const message = await json<MessageBody>(
      request(http)
        .post(
          `/api/families/${familyId}/members/${memberId}/message-suggestions`,
        )
        .set(auth())
        .send({
          occasionLabel: 'Birthday',
          extraNote: 'I cannot come home this year',
        }),
      201,
    );
    expect(message.variants.map((v) => v.length)).toEqual([
      'short',
      'standard',
      'heartfelt',
    ]);
  });

  it('screen 23: a title-only memo resolves as evidence with the title as its text', async () => {
    // memo có title bắt buộc, content tuỳ chọn (schema 2026-08-19) — evidence
    // từng trả text=null cho memo chỉ-title, UI hiểu nhầm là "nguồn đã bị xoá"
    const memo = await json<IdBody>(
      request(http)
        .post(`/api/families/${familyId}/members/${memberId}/memos`)
        .set(auth())
        .send({ title: 'Bà chỉ uống trà không đường', category: 'health' }),
      201,
    );
    const refs = await json<
      { ref: string; kind: string; text: string | null; topic: string | null }[]
    >(
      request(http)
        .get(
          `/api/families/${familyId}/members/${memberId}/evidence?refs=memo_${memo.id}`,
        )
        .set(auth()),
      200,
    );
    expect(refs).toHaveLength(1);
    expect(refs[0].kind).toBe('memo');
    expect(refs[0].text).toBe('Bà chỉ uống trà không đường');
    expect(refs[0].topic).toContain('health');
  });

  it('screen 26: renders a card PNG and returns a viewable media id', async () => {
    const card = await json<CardBody>(
      request(http).post(`/api/families/${familyId}/cards`).set(auth()).send({
        template: 'marigold',
        message: 'Happy birthday!',
        toName: 'Grandma',
        fromName: 'E2E',
        heading: 'BIRTHDAY',
      }),
      201,
    );
    expect(card.media_id).toBeTruthy();
    await request(http)
      .get(`/api/media/${card.media_id}`)
      .set(auth())
      .expect(200);
  });

  it('screen 26: Vietnamese text and a long custom occasion still render', async () => {
    // heading 45 ký tự — cap 30 cũ làm "Save the card" 400 im lặng; chữ Việt
    // có thanh điệu từng ra tofu vì Georgia thiếu glyph Extended Additional
    const card = await json<CardBody>(
      request(http)
        .post(`/api/families/${familyId}/cards`)
        .set(auth())
        .send({
          template: 'tet',
          message:
            'Chúc mừng năm mới! Cả nhà chúc bà mạnh khoẻ, bình an và thật nhiều niềm vui.',
          toName: 'Bà Nội',
          fromName: 'Cháu của bà',
          heading: 'Kỷ niệm ngày ông bà về thăm quê hương yêu dấu',
        }),
      201,
    );
    expect(card.media_id).toBeTruthy();
    await request(http)
      .get(`/api/media/${card.media_id}`)
      .set(auth())
      .expect(200);
  });

  it('screens 27-33: storyboard → AI-mode job renders a real mp4, streams and shares to the feed', async () => {
    const sb = await json<StoryboardBody>(
      request(http)
        .post(`/api/families/${familyId}/video-jobs/storyboard`)
        .set(auth())
        .send({
          memberId,
          mediaIds,
          targetSec: 30,
          mood: 'warm',
          locale: 'ja',
        }),
      201,
    );
    expect(sb.scenes).toHaveLength(3);

    const job = await json<JobBody>(
      request(http)
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
            title: sb.title,
            subtitle: sb.subtitle,
            opening: sb.opening,
            closing: sb.closing,
            dedication: sb.dedication,
            palette: sb.palette,
            scenes: sb.scenes.map((s) => ({
              mediaId: s.media_id,
              durationS: s.duration_s,
              caption: s.caption,
            })),
          },
        }),
      201,
    );

    await request(http)
      .post(`/api/video-jobs/${job.id}/render`)
      .set(auth())
      .expect(201);

    let done: JobBody = { id: job.id, status: 'PROCESSING', duration_s: null };
    for (
      let i = 0;
      i < 200 && done.status !== 'DONE' && done.status !== 'FAILED';
      i++
    ) {
      await new Promise((r) => setTimeout(r, 2000));
      done = await json<JobBody>(
        request(http).get(`/api/video-jobs/${job.id}`).set(auth()),
        200,
      );
    }
    expect(done.status).toBe('DONE');
    expect(Number(done.duration_s)).toBeGreaterThan(5);

    await request(http)
      .get(`/api/video-jobs/${job.id}/file`)
      .set({ ...auth(), range: 'bytes=0-99' })
      .expect(206);

    // Range vượt cuối file phải là 416 kèm độ dài thật (RFC 9110) — từng nổ 500
    // vì createReadStream nhận start > end khi player seek quá cuối
    const res416 = await request(http)
      .get(`/api/video-jobs/${job.id}/file`)
      .set({ ...auth(), range: 'bytes=99999999999-' })
      .expect(416);
    expect(res416.headers['content-range']).toMatch(/^bytes \*\/\d+$/);

    const share = await json<ShareBody>(
      request(http)
        .post(`/api/video-jobs/${job.id}/share`)
        .set(auth())
        .send({ caption: 'E2E memory video' }),
      201,
    );
    const feed = await json<unknown>(
      request(http).get(`/api/families/${familyId}/posts`).set(auth()),
      200,
    );
    expect(JSON.stringify(feed)).toContain(share.post_id);

    // share COPY file sang media của post — xoá post đã share không được phá
    // video gốc của job (từng làm job DONE nhưng file biến mất)
    await request(http)
      .delete(`/api/posts/${share.post_id}`)
      .set(auth())
      .expect(200);
    await request(http)
      .get(`/api/video-jobs/${job.id}/file`)
      .set(auth())
      .expect(200);
  });

  it('quick mode renders with no AI and no cards', async () => {
    const job = await json<JobBody>(
      request(http)
        .post(`/api/families/${familyId}/video-jobs`)
        .set(auth())
        .send({ mediaIds, mode: 'quick', musicId: 'twinkle' }),
      201,
    );
    await request(http)
      .post(`/api/video-jobs/${job.id}/render`)
      .set(auth())
      .expect(201);

    let status = 'PROCESSING';
    for (let i = 0; i < 120 && status !== 'DONE' && status !== 'FAILED'; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const st = await json<JobBody>(
        request(http).get(`/api/video-jobs/${job.id}`).set(auth()),
        200,
      );
      status = st.status;
    }
    expect(status).toBe('DONE');
  });
});

# AI Architecture

Sprint 2 · viết 19/08/2026. Đây là kiến trúc AI ĐANG CHẠY (không phải đề xuất) — đã verify bằng
`pnpm verify` (pytest 7/7 + Jest e2e 8/8, gồm render video thật) và các lượt E2E với key thật.

## Sơ đồ

    Expo (apps/mobile)                 ← 13 màn design 21-33 (11a→11l) + hub "Present"
        │ REST (bearer)
        ▼
    NestJS (apps/api)                  ← authorization + gom evidence + orchestrate + RENDER
        │  src/ai (gift/message/card) ─┬─→ apps/ai (FastAPI)  → OpenAI (json_schema strict)
        │  src/ai/profile.service    ──┤
        │  src/video (VideoJob async) ─┘        │
        │  src/ai/shops.service        ────────→ Yahoo!ショッピング API (sản phẩm thật)
        ▼
    PostgreSQL (Prisma)                ← InterestSignal / MemberProfile / VideoJob / Plan / Memo / …

- **apps/ai (FastAPI, Python 3.12)** — nơi DUY NHẤT gọi AI provider. 5 endpoint:
  `/v1/gift-ideas`, `/v1/message-suggestions`, `/v1/video-storyboard`, `/v1/analyze-post`,
  `/v1/profile-rollup` (+`/health`). Không đọc DB, không giữ dữ liệu nghiệp vụ; NestJS gửi
  context đã lọc quyền kèm request.
  `.env`: `AI_MOCK`, `OPENAI_API_KEY`, `MODEL_ANALYSIS`, `MODEL_SUGGEST`, `INTERNAL_TOKEN`.
- **NestJS `src/ai`** — gom EVIDENCE thật (memo về member + post có tag, membership-check),
  gift ideas + save/saved, message 3 biến thể, card PNG server-side (sharp, 5 mẫu, 0 token),
  tra sản phẩm Yahoo per-idea, và TẦNG HIỂU NGƯỜI DÙNG (`profile.service.ts`, mục dưới).
- **NestJS `src/video`** — render là media-processing 0-token nên nằm ở đây, KHÔNG ở FastAPI.
  Engine port nguyên từ demo `onemoretime-demo` (đã qua 92 smoke checks bên đó) vào
  `src/video/engine/`: cut đúng nhịp nhạc (BPM), Ken Burns tuyến tính 2-4%/shot,
  counter-slide/bloom/whip, 6 phong cách card mở đầu/kết, audio ducking (tiếng trong clip giữ
  nguyên, nhạc nén xuống bằng sidechaincompress). Thư viện nhạc: 45 track thật trong
  `apps/api/assets/music` (5 chủ đề) + 6 track synth tự tổng hợp; nhạc riêng của user đi qua
  `musicId = "media:<mediaId>"`. `VideoJob` async: PENDING → PROCESSING (progress + stage cho
  màn 32) → DONE (+Notification `AI_SUGGESTION`) / FAILED. Share = tạo Post đính media kết quả.

## Hiểu một người là ai, thích gì — hai tầng

Nếu mỗi lần gợi ý lại đọc lại toàn bộ bài đăng thì vừa tốn token vừa KHÔNG có ký ức: mâu thuẫn
theo thời gian không ai xử lý, và "bà đã bỏ ngọt từ tháng Tư" không bao giờ thắng nổi một bức ảnh
bánh kem năm ngoái. Nên có hai tầng (port từ demo `onemoretime-demo`, đã chạy thật):

    bài đăng mới ──analyze (1 call, nhiều ảnh)──►  InterestSignal
                                                  bằng chứng NGUYÊN TỬ, append-only
                                                          │
                             đủ ROLLUP_EVERY_N_POSTS bài, │ rollup (1 call)
                             hoặc ngay trước khi gợi ý    ▼
                                                  MemberProfile v+1
                                                  bản chưng cất ~1k token, version hoá

**Chưng cất NGAY sau mỗi bài** (`ROLLUP_EVERY_N_POSTS` mặc định **1**). Lý do: rollup lúc
gợi ý là thứ người dùng phải ngồi chờ, còn rollup lúc đăng bài chạy nền không ai thấy. Dồn 5 bài
chỉ tiết kiệm vài call nhưng đánh đổi đúng chỗ đau nhất.

**Tầng 1 — `InterestSignal`** (`ProfileService.analyzePost`, chạy nền khi tạo bài):
- Một bài = ĐÚNG một call AI, kể cả 6 ảnh (ảnh 768px, `detail: "low"`, EXIF/GPS bị strip).
- Prompt ép `context_analysis` điền TRƯỚC: ai làm gì với ai, tác giả là ACTOR / RECIPIENT /
  OBSERVER. Đây là thứ tránh bug tốn công nhất của demo: caption "Con trai về quê thăm mẹ" do
  người mẹ đăng nói lên rằng MẸ ĐƯỢC con về thăm, không phải mẹ thích đi thăm ai.
- Signal LUÔN thuộc về NGƯỜI ĐĂNG (không phải người trong ảnh), 0-4 cái/bài, mỗi cái là một sự
  thật BỀN ("còn đúng và còn dùng được sau ba tháng không?").
- Code (không tin model) quyết: `sourceType` suy từ `basis`, trần confidence theo nguồn
  (caption 0.75 · ảnh 0.85 · người dùng ♡ 0.9), `observedAt` = ngày sự việc.
- Append-only: không bao giờ sửa nội dung, chỉ set `processed` / `revoked`.
- Lỗi tạm của provider (429/5xx) được **thử lại một lần sau 8s**: không có gì kích hoạt lần hai
  nên bỏ luôn là mất vĩnh viễn hiểu biết từ bài đó. Vẫn lỗi → log + `POST /posts/:id/analyze` tay.

**Tầng 2 — `MemberProfile`** (`ProfileService.rollupMember`, 6 quy tắc trong `ROLLUP_SYSTEM`):
1. Không bịa — mọi interest phải trỏ signal id thật.
2. Nguồn NGƯỜI ghi đè nguồn MÁY (♡ conf 0.9 thắng suy luận từ ảnh khi mâu thuẫn).
3. Mới thắng cũ — cái cũ chuyển `trend: fading`; nếu là sức khoẻ → `avoid` với `hard: true`.
4. Gộp topic gần nghĩa, evidence cộng dồn.
5. Trần 12 interests / ~1k token (cắt bằng CODE sau khi model trả về).
6. `trend` rising/stable/fading theo mật độ bằng chứng 6 tháng gần nhất.
- `gift_history` được ghép lại bằng CODE (chỉ thêm, không xoá) — không tin model giữ hộ.
- Mỗi rollup tạo VERSION MỚI, version cũ không bao giờ bị ghi đè → xem lại được hồ sơ tại thời
  điểm bất kỳ, và một gợi ý luôn truy được về đúng hồ sơ đã sinh ra nó.

**Memo cố tình KHÔNG vào profile.** Ghi chú người thân viết tay là nguồn tin cậy CAO NHẤT nên
được đưa tới model NGUYÊN VĂN từng chữ ở mỗi lượt gợi ý (khối riêng trong prompt), thay vì bị
chưng cất mất chi tiết. Kiêng kỵ sức khoẻ trong memo được tôn trọng như `avoid hard`.

**Gợi ý quà/lời nhắn chỉ đọc HỒ SƠ + MEMO — không đọc lại caption bài đăng.** Mỗi bài đã được
phân tích một lần khi đăng; nhồi caption vào prompt lần nữa là phân tích hai lần cùng một dữ liệu
(chậm hơn, tốn token hơn, không biết thêm gì). Provenance vẫn nguyên: model trích `sig_…` có trong
hồ sơ, và `GET /families/:id/members/:id/evidence?refs=sig_…,memo_…` lần về đúng signal → bài gốc →
tấm ảnh, nên sheet "Where this came from" (màn 23) vẫn mở được ảnh thật và "Open the post".
Bài gốc bị xoá thì trả lại chi tiết signal, không câm lặng.

**Hai tầng cache, độc lập:**
- `AiSuggestionCache` — cả lượt gợi ý, khoá `gift|member|dịp|v<profileVersion>|ngân sách|locale`,
  hết hạn cuối ngày diễn ra dịp (không rõ ngày → 7 ngày). Có bằng chứng mới → version tăng → tự
  miss. Nút ↻ trên màn Ideas gửi `force: true` để bỏ qua.
- `ProductCache` — sản phẩm sàn theo `(tuần, từ khoá, dải giá)`, không chứa dữ liệu gia đình.

Endpoint để nhìn vào tầng này: `GET /families/:id/members/:id/profile-understanding`
(trả version + profile + số signal đã gộp/chờ gộp), `POST …/profile-rollup` (gộp tay),
`POST /posts/:id/analyze` (đọc lại một bài).

## Tra sản phẩm thật (0 token)

`shops.service.ts` port đầy đủ resolver của demo: AI chỉ đưa Ý TƯỞNG + `search_keywords_ja`;
tầng này gọi Yahoo!ショッピング `itemSearch V3` (`sort=-review_count`, `in_stock`, `condition=new`).
- Quà "together" dùng bảng từ khoá `体験ギフト` hard-code theo `experience_kind` (ở Nhật quà trải
  nghiệm bán dưới dạng catalog gift có thật → vẫn ra link cụ thể).
- Thang thử khi 0 kết quả: nguyên trạng → nới ngân sách (×0.6/×1.8) → rút gọn từ khoá → nới cả
  hai. Đã nới thì tên sản phẩm BẮT BUỘC chứa ≥1 từ khoá gốc (thà không hiện còn hơn hiện sai).
- Lọc giá ±10% theo dải đã dùng, loại token vi phạm `avoid` (bản đồ VI/EN → token JP), bỏ trùng
  theo 40 ký tự đầu của tên, chấm điểm `0.35×giá hợp lý + 0.25×uy tín review + 0.2×khớp từ khoá
  + 0.1×có ảnh`, giữ TOP 3. Lọc theo dải đã nới nhưng CHẤM ĐIỂM theo ngân sách gốc.
- `resolve` trả về UI: `cached` / `relaxed` / `dropped_by_avoid` / `attempts` — để giá lệch ngân
  sách luôn có lời giải thích.

## Độ trễ — đo 19/08, và vì sao nó từng chậm

| Chặng | Trước (gpt-5) | Sau | Demo cùng model |
|---|---|---|---|
| Gợi ý quà (cả tra sàn) | 100.3s | **15.5s** | 14.0s |
| Gợi ý quà — chỉ call AI | 77.9s | 13-16s | 14.0s |
| Gợi ý quà — chỉ tra sàn | ~22s | **0.4s** | — |
| Lời nhắn | 63.7s | **~6s** | 5.7s |
| Mở lại đúng dịp đó (cache) | — | **0.1s** | — |

Bốn nguyên nhân, theo thứ tự tác động:

1. **Model.** `gpt-5` là model reasoning: một lượt gợi ý quà mất 78 giây, chiếm ~78% tổng thời gian.
   Demo onemoretime chạy `gpt-5.6-luna` cho MỌI việc. Nay NHA dùng đúng model đó
   (`MODEL_ANALYSIS` = `MODEL_SUGGEST` = `gpt-5.6-luna`) kèm `max_completion_tokens: 8192`.
   **Đừng đổi lại `gpt-5` mà không đo lại.**
2. **Số TOKEN ĐẦU RA quyết định độ trễ** — quan hệ gần như tuyến tính, đo được trong `ai.log`:
   out 1420 → 13.4s · out 1733 → 20.7s · out 2359 → 24.3s. Nên prompt đặt trần ký tự cho từng
   trường (title ≤ 40, why một câu ≤ 140, tag ≤ 12, insight ≤ 110, note ≤ 220) và yêu cầu ĐÚNG 5
   ý tưởng. Muốn nhanh hơn nữa thì cắt bớt trường, không phải "nhắc model nhanh lên".
3. **Prompt phình vì lặp.** Từng gửi 24 caption bài đăng (rồi 6) SONG SONG với hồ sơ — mà hồ sơ
   chính là bản chưng cất của những bài đó. Nay **không gửi caption nào**: mỗi bài chỉ được đọc
   một lần ở `analyzePost`. Cũng bỏ luôn việc gửi hai lần cùng một sự thật (`interests` phẳng +
   `profile.interests`): input 2651 → 2362 token.
4. **Tra sàn tuần tự.** 5 ý tưởng × tối đa 4 lần thử = ~22s. Giờ 3 luồng song song + cache tuần
   → 0.4s (không mở rộng hơn 3: Yahoo ~1 req/s, bị 429 là trắng sản phẩm).

Log để đo lại bất cứ lúc nào: FastAPI ghi `suggest_gift gpt-5.6-luna 15.0s in=2439 out=1520`,
NestJS ghi `gift ideas: AI 15.0s · shops 0.4s · 5 ý tưởng, 3 lượt gọi sàn`.

## Nguyên tắc bắt buộc (đã encode trong code + test)

1. **Provenance**: mọi gợi ý mang `why` + `sources[]`; service LỌC source về evidence thật
   (id lạ bị vứt — cả mock lẫn real). Số evidence đã đọc trả về TRƯỚC danh sách ý tưởng.
2. **Kiêng kỵ cứng**: `MemberProfile.avoid` (hard) + phần tử `"avoid:<...>"` trong
   `LifeProfile.interests` là ràng buộc tuyệt đối; `note_to_giver` LUÔN được viết — không có gì
   cần tránh thì phải nói ra như vậy, không được để trống (UI khối "Worth knowing").
3. **Core sống khi AI chết**: `AI_MOCK=1` trả dữ liệu giả lập đúng schema 0 token; AI service sập
   → NestJS trả 503 rõ ràng; đăng bài KHÔNG bao giờ fail vì analyze lỗi (chạy nền, chỉ log);
   video quick-mode ("stitch in my order") không đụng AI.
4. **AI sinh Ý TƯỞNG, không sinh sản phẩm** — tên/giá/★/shop luôn từ API sàn.
5. **Trả lời bằng ngôn ngữ người dùng đang xem** — mobile gửi `locale` từ i18n; không có nó thì
   màn hình tiếng Nhật nhận về ý tưởng tiếng Anh (đã dính 19/08).
6. **Strict Structured Outputs**: mọi call OpenAI dùng `json_schema strict` sinh từ pydantic;
   ⚠ strict mode KHÔNG nhận dict tự do — palette và mọi field con của profile phải là model
   tường minh (đã dính 1 lần ở palette).

## Chạy & test

    pnpm dev:ai        # FastAPI :8000 (tự tạo venv lần đầu)
    pnpm dev:api       # NestJS :3000 (Postgres portable: C:\NHA\pgsql\bin\pg_ctl -D C:\NHA\pgdata start)
    pnpm test:ai       # pytest, mock mode, 0 token
    pnpm test:e2e      # Jest e2e apps/api — auth→media→post→gift→message→card→storyboard→render THẬT→share
    pnpm verify        # tokens + tsc api/mobile + i18n + pytest + jest e2e

`ROLLUP_EVERY_N_POSTS` (env, mặc định **1** = chưng cất ngay sau mỗi bài). Đặt >1 chỉ khi cần
tiết kiệm token và chấp nhận rollup nổ ra lúc người dùng đang chờ gợi ý.

## Chưa làm / biết trước

- Video storyboard chưa đọc `MemberProfile` (chỉ đọc caption + metadata media) — nối vào là bước
  sau nếu muốn video "hiểu người".
- Chưa có RAG vector cho kỷ niệm (demo dùng embedding + cosine để chọn top-3 kỷ niệm liên quan);
  hiện gửi memo + caption mới nhất theo thứ tự thời gian.
- Chưa trích keyframe video khi analyze (chỉ ảnh); tiếng nói trong clip chưa chuyển thành text.
- Time-decay `eff_conf = conf × 0.5^(tháng/half-life)` chưa cài — hiện dùng confidence thô + trend.
- Provider/model đặt qua env (`gpt-5`/`gpt-5-mini` mặc định) — quyết định chính thức của team vẫn mở.

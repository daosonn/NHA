# Sprint 2 — Kỷ niệm & AI

> Status: **backend started 2026-08-19** (sprint 1's backend side is
> finished; frontend is still wiring sprint-1 screens in parallel).
> **AI side delivered 2026-08-20** on branch `merge/ai-integration`
> (PR pending): groups 2.2–2.5 done end-to-end — `apps/ai` (FastAPI,
> model-level call landed on gpt-5.6-luna), NestJS `src/ai` + `src/video`,
> and the mobile screens 21-33 (gift → message → card → memory video).
> Verified by e2e (10 tests incl. a real ffmpeg render), pytest, and live
> smoke; perf pass measured and recorded in `docs/03-ai/architecture.md`.
> Ownership: the **AI team owns `apps/ai`** and everything model-side
> (incl. the 2.2 video render); backend owns the NestJS API side. The
> seam both build against: `docs/03-ai/architecture.md` (drafted
> 2026-08-19; provider direction Claude API).
> Source: team WBS. IDs kept from the WBS for traceability.

## Sprint Goal

Memory + AI: the family can browse shared memories, generate a video from
photos, and get AI suggestions (gifts, messages, quality time).

## Scope

### 2.1 Nav2 – 思い出 / Kỷ niệm — Trang Memories

- [x] 2.1.1 DB Memory — reuse `Post`, no new model (design sprint 0; confirmed at implementation 2026-08-19)
- [x] 2.1.2 API danh sách Memory (theo family) — done 2026-08-19 (chi tiết: `api-contract.md`); UI chưa nối
- [ ] 2.1.3 UI danh sách Kỷ niệm (card/grid)
- [ ] 2.1.4 Chi tiết Kỷ niệm (ảnh + bài viết)
- [ ] 2.1.5 Kỷ niệm chung gia đình (shared memory)

### 2.2 Generate Video — MVP video generation

- [x] 2.2.1 Chọn ảnh làm video (multi-select) — done 2026-08-20, màn 28: lọc theo
      family/Mine, chọn có SỐ THỨ TỰ + "Choose for me" (branch `merge/ai-integration`)
- [x] 2.2.2 Gửi request generate (VideoJob — async) — done 2026-08-19 (chi tiết: `api-contract.md`); render thuộc team AI
- [x] 2.2.3 Hiển thị trạng thái (processing/done) — done 2026-08-20, màn 32 Making:
      checklist theo stage thật của worker + rời màn được + notification khi DONE
- [x] 2.2.4 Preview kết quả (xem video) — done 2026-08-20, màn 33: player + full
      screen + Save + Share về timeline (share COPY file, xoá post không phá video)
- [x] (AI team) Render engine — done 2026-08-20: ffmpeg 0-token (intro/outro theo
      6 style, Ken Burns, ducking nhạc dưới tiếng nói), render song song
      (49s → ~25s cho phim 41s, đo 2026-08-20)

### 2.3 Nav3 – AI — AI Assistant

- [x] 2.3.1 UI AI (form + result) — done 2026-08-20: hub Present + chuỗi màn 21-26
- [x] 2.3.2 Tích hợp AI API — done 2026-08-20: `apps/ai` FastAPI 5 endpoint
      (analyze-post / profile-rollup / gift-ideas / message-suggestions /
      video-storyboard), structured outputs strict, mock mode `AI_MOCK=1`;
      contract + số đo trong `docs/03-ai/architecture.md`

### 2.4 AI gợi ý quà — Gift suggestion

- [x] 2.4.1 Chọn người nhận (member) — done 2026-08-20 (màn 21)
- [x] 2.4.2 Nhập dịp/sở thích (context) — done 2026-08-20: dịp + slider ngân sách;
      context lấy từ profile chưng cất 2 tầng + memo CỦA NGƯỜI HỎI (chốt 2026-08-20)
- [x] 2.4.3 Generate gợi ý quà (≥3 gợi ý) — done 2026-08-20: đúng 5 ý + ≥1 "together",
      sản phẩm thật Yahoo!ショッピング, provenance chip lần về memo/bài gốc (màn 22-23)

### 2.5 AI gợi ý lời nhắn — Message suggestion

- [x] 2.5.1 Chọn người/dịp (context) — done 2026-08-20 (màn 24)
- [x] 2.5.2 Generate lời nhắn (có regenerate) — done 2026-08-20: 3 biến thể
      Short/Standard/Heartfelt + "Say it differently" (re-roll thật qua `force`),
      thiệp PNG 5 mẫu ở màn 26

### 2.6 AI Quality Time — Gợi ý hoạt động

- [ ] 2.6.1 Chọn thành viên (family member)
- [ ] 2.6.2 Nhập thời gian/sở thích (context)
- [ ] 2.6.3 Generate kế hoạch (danh sách hoạt động)
- [ ] 2.6.4 Lưu & chia sẻ plan (bảng `Plan` + `PlanShare` — chỉ chủ sửa/chia sẻ, người được chia sẻ chỉ xem; added 2026-08-14, see `database.md`)

### 2.7 Test Sprint 2

- [ ] Fix blocker

## Out of Scope (this sprint)

- Notifications/reminders/settings (Sprint 3)
- AI interest analysis as an automatic pipeline — MVP AI takes user-entered
  context (see gap notes in `mvp-scope.md`)
- Auto albums (only video generation is scheduled)

## Notes

- `apps/ai` (FastAPI) is created in this sprint; core product must keep
  working when AI is unavailable (`product-overview.md` § 14).
- ~~AI provider/model choice is still an open decision~~ — decided by the
  AI team: **gpt-5.6-luna** for every call (analysis, rollup, suggestions,
  storyboard), recorded with parameters and latency numbers in
  `docs/03-ai/architecture.md` (2026-08-19, perf pass 2026-08-20).
- 2.6 (Quality Time) is the one sprint-2 AI group not started — the
  `Plan` table it needs is live (gift-save already writes to it).

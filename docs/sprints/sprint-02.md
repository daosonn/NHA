# Sprint 2 — Kỷ niệm & AI

> Status: **backend started 2026-08-19** (sprint 1's backend side is
> finished; frontend is still wiring sprint-1 screens in parallel).
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

- [x] 2.1.1 DB Memory — **design note**: reuse the `Post` table from
      Sprint 1 (filter by family/member/time) instead of a separate Memory
      model — see `docs/02-backend/database.md`. Confirmed at
      implementation 2026-08-19: không cần model mới.
- [x] 2.1.2 API danh sách Memory (theo family) — done 2026-08-19: filter
      `?memberId`/`?from`/`?to`/`?type` trên `GET /families/:id/posts`
      (chi tiết: `api-contract.md`); UI chưa nối
- [ ] 2.1.3 UI danh sách Kỷ niệm (card/grid)
- [ ] 2.1.4 Chi tiết Kỷ niệm (ảnh + bài viết)
- [ ] 2.1.5 Kỷ niệm chung gia đình (shared memory)

### 2.2 Generate Video — MVP video generation

- [ ] 2.2.1 Chọn ảnh làm video (multi-select)
- [ ] 2.2.2 Gửi request generate (VideoJob — async)
- [ ] 2.2.3 Hiển thị trạng thái (processing/done)
- [ ] 2.2.4 Preview kết quả (xem video)

### 2.3 Nav3 – AI — AI Assistant

- [ ] 2.3.1 UI AI (form + result)
- [ ] 2.3.2 Tích hợp AI API (request hoạt động — `apps/ai` FastAPI contract,
      design in `docs/03-ai/` at sprint start)

### 2.4 AI gợi ý quà — Gift suggestion

- [ ] 2.4.1 Chọn người nhận (member)
- [ ] 2.4.2 Nhập dịp/sở thích (context)
- [ ] 2.4.3 Generate gợi ý quà (≥3 gợi ý)

### 2.5 AI gợi ý lời nhắn — Message suggestion

- [ ] 2.5.1 Chọn người/dịp (context)
- [ ] 2.5.2 Generate lời nhắn (có regenerate)

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
- AI provider/model choice is still an open decision — decide at sprint
  start and record in `docs/03-ai/`.

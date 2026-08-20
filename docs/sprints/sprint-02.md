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
photos, and get AI suggestions (gifts, messages). ~~quality time~~ — the
third suggestion type was dropped 2026-08-20, see § 2.6.

## Scope

### 2.1 Nav2 – 思い出 / Kỷ niệm — Trang Memories

- [x] 2.1.1 DB Memory — reuse `Post`, no new model (design sprint 0; confirmed at implementation 2026-08-19)
- [x] 2.1.2 API danh sách Memory (theo family) — done 2026-08-19 (chi tiết: `api-contract.md`); UI chưa nối
- [ ] 2.1.3 UI danh sách Kỷ niệm (card/grid)
- [ ] 2.1.4 Chi tiết Kỷ niệm (ảnh + bài viết)
- [ ] 2.1.5 Kỷ niệm chung gia đình (shared memory)

### 2.2 Generate Video — MVP video generation

- [ ] 2.2.1 Chọn ảnh làm video (multi-select) — UI; API sẵn (2.2.2)
- [x] 2.2.2 Gửi request generate (VideoJob — async) — done 2026-08-19 (chi tiết: `api-contract.md`); render thuộc team AI
- [ ] 2.2.3 Hiển thị trạng thái (processing/done) — UI; API poll sẵn
- [ ] 2.2.4 Preview kết quả (xem video) — UI; stream qua `GET /media/:resultMediaId` sẵn

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

### 2.6 AI Quality Time — Gợi ý hoạt động — **BỎ (2026-08-20)**

**Cả nhóm 2.6 không làm nữa** (quyết định 2026-08-20). Lý do và hệ quả
ghi ở `project-status.md` → Important Decisions. Tóm tắt: tính năng này
nằm trong WBS nhưng **không có dòng nào trong `mvp-scope.md`**, và AI
sprint 2 chốt ở hai tính năng đã chạy end-to-end là gợi ý quà (2.4) và
gợi ý lời nhắn (2.5).

- ~~2.6.1 Chọn thành viên (family member)~~ — bỏ
- ~~2.6.2 Nhập thời gian/sở thích (context)~~ — bỏ
- ~~2.6.3 Generate kế hoạch (danh sách hoạt động)~~ — bỏ; chưa bao giờ có API
- ~~2.6.4 Lưu & chia sẻ plan (`Plan` + `PlanShare`)~~ — bỏ. API **đã viết
  và verify xong** 2026-08-20 nhưng **không merge**: nằm ở branch
  `feature/plans` nếu sau này quay lại. Hai bảng `Plan`/`PlanShare` **giữ
  nguyên trong schema** (rỗng, vô hại — xoá thì tốn một migration cho thứ
  có thể sống lại).

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

# Sprint 1 — Core Features

> Status: **active** (defined 2026-08-13, not yet started).
> Source: team WBS. IDs kept from the WBS for traceability.
> Design references: `docs/02-backend/database.md`,
> `docs/02-backend/architecture.md`, `docs/00-shared/domain-model.md`,
> `docs/01-frontend/screens.md`.

## Sprint Goal

Hoàn thiện chức năng nền: a user can register, log in, create/join a family,
build the family tree, post content with photos, and view member profiles.

## Scope

### 1.1 Đăng ký / Đăng nhập — Authentication hoàn chỉnh

- [ ] 1.1.1 UI đăng ký (form đăng ký) — UI xong 2026-08-18; **nối API xong
      2026-08-18** (`POST /auth/register`, token vào expo-secure-store). Chờ
      verify trên thiết bị trước khi tick.
- [x] 1.1.2 API đăng ký (tạo tài khoản) — done 2026-08-17: merged in PR #2
- [x] 1.1.3 Validate dữ liệu (email/password) — done 2026-08-17: DTO +
      class-validator behind global ValidationPipe, merged in PR #2
- [ ] 1.1.4 UI đăng nhập (form login) — UI xong 2026-08-18; **nối API xong
      2026-08-18** (`POST /auth/login`, refresh-on-401 single-flight). Chờ
      verify trên thiết bị trước khi tick.
- [x] 1.1.5 API đăng nhập (JWT access + refresh — see backend architecture)
      — done 2026-08-17: merged in PR #2
- [x] 1.1.6 Đăng xuất (revoke refresh token) — done 2026-08-17: single-use
      refresh rotation + revoke on logout, merged in PR #2
- [ ] 1.1.7 Khôi phục mật khẩu (quên mật khẩu — `PasswordResetToken`; added 2026-08-14, see `database.md`)
- [x] 1.1.8 Google login (OAuth authorization code, `OAuthAccount` — customer requirement, added 2026-08-17; see `02-backend/architecture.md`) — done 2026-08-18: backend merged in PR #3, happy path verified end-to-end với credentials thật (consent screen External + test user)
- [ ] 1.1.9 Facebook login (chung flow OAuth với 1.1.8 — added 2026-08-17; LINE deferred chờ quyền email, X phase 2) — backend merged in PR #3; chờ verify E2E (cần accept tester role trên Meta app)

### 1.2 Nav1 – Trang chủ — Trang chính sau login

- [ ] 1.2.1 Navigation chính (Nav1/Nav2/Nav3/Nav4)
- [ ] 1.2.2 Layout Home (responsive, mobile-first 375–430px) — UI xong
      2026-08-18; **nối `GET /families` 2026-08-18** kèm loading / error /
      empty. Widget dịp đặc biệt và recommendations vẫn là fixture (chưa có
      endpoint).
- [ ] 1.2.3 Load bài viết gần đây (feed cơ bản) — API done 2026-08-18:
      `GET /api/families/:familyId/posts` (mới nhất trước, cursor
      pagination, membership-based authorization); UI chưa nối
- [ ] 1.2.4 Empty/loading state (UI đầy đủ) — Home xong 2026-08-18 (kể cả
      trạng thái "chưa có gia đình nào"); các màn khác chưa.
- [ ] 1.2.5 Widget dịp đặc biệt trên Home (countdown + theme — sinh nhật/ngày giỗ derived từ LifeProfile; added 2026-08-14, see `database.md`)

### 1.3 Tạo nhóm gia đình — Family Group

- [x] 1.3.1 DB Family Group (Family + FamilyMember — incl. placeholder
      members, see `database.md`) — done 2026-08-14: full-MVP schema,
      25 models + migration, merged in PR #1
- [ ] 1.3.2 UI tạo nhóm (nhập tên nhóm) — **xong 2026-08-18**:
      `app/create-family.tsx`, gộp cả tạo mới và tham gia bằng invite code, đã
      nối `POST /families` + `POST /families/join`. Chờ verify trên thiết bị.
- [x] 1.3.3 API tạo nhóm (lưu group, sinh invite code) — done 2026-08-17:
      merged in `107acb1`
- [x] 1.3.4 Thêm thành viên (add member — có account hoặc placeholder) —
      done 2026-08-17: placeholder qua API, account qua join-by-invite-code
      (kèm link vào placeholder); merged in `107acb1`
- [x] 1.3.5 Chọn quan hệ thành viên (cha/mẹ/con/… + loại ngoại lệ) — done
      2026-08-17: relationships CRUD; merged in `107acb1`
- [x] 1.3.6 Sửa/xóa thành viên (CRUD) — done 2026-08-17: placeholder
      wiki-editable, linked member chỉ tự sửa/tự rời; merged in `107acb1`

### 1.4 Cây gia phả — Family Tree

> Màn mời thành viên (invite sheet, pending spot, trang nhận lời mời) đã
> code UI 2026-08-18 nhưng không nằm trong checklist sprint 1 — nó cần một
> bản ghi invitation phía backend, xem `project-status.md` → Important
> Decisions ("Invites are per-spot"). Cần thêm task backend trước khi nối.

- [x] 1.4.1 API relationship (dữ liệu cây) — done 2026-08-18:
      `GET /api/families/:familyId/tree` trả member nodes + relationship
      edges (membership-based authorization); verified lint/test/build +
      live smoke test (200/401/403); đã merge vào `main`. (Tick từng bị
      mất khi resolve conflict PR #6 — khôi phục sau PR #5.)
- [ ] 1.4.2 Render Family Tree (hiển thị quan hệ) — UI xong 2026-08-18 (mock data, chưa nối API)
- [ ] 1.4.3 Click member → Profile (điều hướng profile) — UI xong 2026-08-18 (mock data, chưa nối API)

### 1.5 Nav2.5 – Bài viết / Ảnh / Sự kiện — Tạo nội dung

- [ ] 1.5.1 UI Create Post (nhập nội dung) — UI xong 2026-08-18 (mock data, chưa nối API)
- [x] 1.5.2 API Post (create/edit/delete) — done 2026-08-18: PostModule
      (`POST/GET/PATCH/DELETE /api/posts`), chỉ tác giả sửa/xóa; post
      private trả 404 nhất quán trên mọi verb; PATCH re-check membership
      hiện tại (ex-member chỉ còn quyền rút post về private). Verified
      lint/build + live smoke test thủ công (chưa có automated test cho
      module — jest vẫn là scaffold specs); review 2026-08-18 đã fix các
      lỗi date/authz
- [x] 1.5.3 Upload ảnh (**backend-only** — preview thuộc UI 1.5.1) —
      done 2026-08-18: StorageService (local disk, `UPLOAD_DIR`, upload
      stream xuống temp file rồi rename — không buffer RAM) +
      MediaModule (`POST /api/media` multipart ảnh/video/audio ≤100MB;
      `GET /api/media/:id` stream có kiểm soát quyền xem + HTTP
      Range/206 cho player video/audio)
- [x] 1.5.4 Tạo sự kiện (tên/ngày/nội dung) — done 2026-08-18:
      `type=EVENT` bắt buộc eventTitle + eventDate (content tùy chọn);
      POST thường cấm hai field này; ngày validate strict ISO 8601
- [x] 1.5.5 Visibility (chung/riêng tư — post to chosen families or
      private) — API done 2026-08-18: `familyIds` chọn nhiều family
      (phải là thành viên); rỗng = riêng tư; PATCH thay được visibility.
      UI xong 2026-08-18 (mock data, chưa nối API)
- [ ] 1.5.6 Comment bài đăng (API + UI — added 2026-08-14, see `database.md`)
- [ ] 1.5.7 Reaction bài đăng (đa dạng loại — added 2026-08-14, see `database.md`)

### 1.6 Nav4 – Hồ sơ đời cá nhân — Profile

- [ ] 1.6.1 UI Profile (avatar + tên) — UI xong 2026-08-18 (mock data, chưa nối API)
- [ ] 1.6.2 About (thông tin cá nhân) — UI xong 2026-08-18 (mock data, chưa nối API)
- [ ] 1.6.3 Timeline chung (bài viết/ảnh theo thời gian) — UI xong 2026-08-18 (mock data, chưa nối API)
- [ ] 1.6.4 Album/Gallery (danh sách ảnh) — UI xong 2026-08-18 (mock data, chưa nối API)
- [ ] 1.6.5 Memo cá nhân (tạo memo — ghi chú về một thành viên, xem `database.md`) — UI xong 2026-08-18 (mock data, chưa nối API)
- ~~1.6.6 Quyền riêng tư Memo (private/shared)~~ — dropped 2026-08-14:
  memo luôn private, chỉ chủ xem/sửa (see `database.md`)
- [ ] 1.6.7 Album cá nhân (private — tạo album, tự thêm ảnh; added 2026-08-14, see `database.md`)
- [ ] 1.6.8 Life Timeline milestones (LifeEvent CRUD + hiển thị theo thời gian; added 2026-08-14, see `database.md`)

### 1.7 Test Sprint 1

- [ ] Fix lỗi chính (main flows stable)

## Out of Scope (this sprint)

- Google OAuth (not scheduled in Sprints 1–3 — see `mvp-scope.md`)
- Memories page, AI features (Sprint 2)
- Notifications, reminders, settings (Sprint 3)
- Time capsule, On This Day, Memory Map

## Notes

- DB schema for this sprint is designed in `docs/02-backend/database.md` —
  implement it as the first Prisma migration of the sprint (replacing the
  demo `User` model).
- Auth mechanism is decided (JWT access + refresh) — see
  `docs/02-backend/architecture.md`.

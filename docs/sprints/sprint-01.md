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

- [ ] 1.1.1 UI đăng ký (form đăng ký)
- [ ] 1.1.2 API đăng ký (tạo tài khoản)
- [ ] 1.1.3 Validate dữ liệu (email/password)
- [ ] 1.1.4 UI đăng nhập (form login)
- [ ] 1.1.5 API đăng nhập (JWT access + refresh — see backend architecture)
- [ ] 1.1.6 Đăng xuất (revoke refresh token)

### 1.2 Nav1 – Trang chủ — Trang chính sau login

- [ ] 1.2.1 Navigation chính (Nav1/Nav2/Nav3/Nav4)
- [ ] 1.2.2 Layout Home (responsive, mobile-first 375–430px)
- [ ] 1.2.3 Load bài viết gần đây (feed cơ bản)
- [ ] 1.2.4 Empty/loading state (UI đầy đủ)

### 1.3 Tạo nhóm gia đình — Family Group

- [ ] 1.3.1 DB Family Group (Family + FamilyMember — incl. placeholder
      members, see `database.md`)
- [ ] 1.3.2 UI tạo nhóm (nhập tên nhóm)
- [ ] 1.3.3 API tạo nhóm (lưu group, sinh invite code)
- [ ] 1.3.4 Thêm thành viên (add member — có account hoặc placeholder)
- [ ] 1.3.5 Chọn quan hệ thành viên (cha/mẹ/con/… + loại ngoại lệ)
- [ ] 1.3.6 Sửa/xóa thành viên (CRUD)

### 1.4 Cây gia phả — Family Tree

- [ ] 1.4.1 API relationship (dữ liệu cây)
- [ ] 1.4.2 Render Family Tree (hiển thị quan hệ)
- [ ] 1.4.3 Click member → Profile (điều hướng profile)

### 1.5 Nav2.5 – Bài viết / Ảnh / Sự kiện — Tạo nội dung

- [ ] 1.5.1 UI Create Post (nhập nội dung)
- [ ] 1.5.2 API Post (create/edit/delete)
- [ ] 1.5.3 Upload ảnh (upload + preview — qua storage service module)
- [ ] 1.5.4 Tạo sự kiện (tên/ngày/nội dung)
- [ ] 1.5.5 Visibility (chung/riêng tư — post to chosen families or private)

### 1.6 Nav4 – Hồ sơ đời cá nhân — Profile

- [ ] 1.6.1 UI Profile (avatar + tên)
- [ ] 1.6.2 About (thông tin cá nhân)
- [ ] 1.6.3 Timeline chung (bài viết/ảnh theo thời gian)
- [ ] 1.6.4 Album/Gallery (danh sách ảnh)
- [ ] 1.6.5 Memo cá nhân (tạo memo)
- [ ] 1.6.6 Quyền riêng tư Memo (private/shared)

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

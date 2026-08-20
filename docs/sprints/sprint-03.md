# Sprint 3 — Notification / Setting / Release

> Status: **backend started 2026-08-20** (defined 2026-08-13).
> Source: team WBS. IDs kept from the WBS for traceability.
>
> Sprint 2 chưa đóng hẳn khi sprint này bắt đầu — xem `project-status.md`:
> nhóm 2.1.3–2.1.5 (trang Memories) chưa làm và chưa quyết, và mười mục
> 2.2–2.5 đã code xong nhưng chưa ai tick.

## Sprint Goal

Hoàn thiện MVP: notifications and reminders work, account settings are
complete, the system passes end-to-end tests, and the MVP is demoed.

## Scope

### 3.1 Thông báo — Notification

- [x] 3.1.1 Notification DB/API (notification model) — done 2026-08-20, không cần migration (bảng có từ sprint 0); chi tiết: `api-contract.md`
- [ ] 3.1.2 Notification UI (danh sách thông báo) — UI; `GET /me/notifications` sẵn (cursor, `?unreadOnly`)
- [ ] 3.1.3 Read/Unread (update trạng thái) — UI; `PATCH /me/notifications/:id/read` + `POST .../read-all` sẵn
- [ ] 3.1.4 Badge notification (hiện số chưa đọc) — UI; `GET /me/notifications/unread-count` sẵn, và `unreadCount` cũng nằm sẵn trong response danh sách

### 3.2 Nhắc ngày đặc biệt — Birthday/Event

- [ ] 3.2.1 Lấy birthday/event (query DB — LifeProfile.birthDate, Event)
- [ ] 3.2.2 Tạo reminder (tự động tạo notification)
- [ ] 3.2.3 CRUD `SpecialDate` (kỷ niệm / dịp tùy chỉnh + nhắc; added 2026-08-14, see `database.md`) — API done 2026-08-20 (POST/PATCH/DELETE + `GET .../custom`; chi tiết: `api-contract.md`); UI + phần "nhắc" (3.2.2) chưa làm

### 3.3 Nhắc quan tâm — Care reminder

- [ ] 3.3.1 Rule nhắc quan tâm (logic MVP)
- [ ] 3.3.2 Hiển thị reminder (notification hiển thị)

### 3.4 Cài đặt Account — Account settings

- [ ] 3.4.1 Sửa thông tin (update profile)
- [ ] 3.4.2 Đổi avatar (upload avatar)
- [ ] 3.4.3 Đổi password (update password)
- [ ] 3.4.4 Privacy settings (thiết lập quyền riêng tư)
- [ ] 3.4.5 Notification settings (bật/tắt nhắc)

### 3.5 System Integration Test — Test end-to-end

- [ ] 3.5.1 Test Login → Home
- [ ] 3.5.2 Test Family → Profile
- [ ] 3.5.3 Test Post → Timeline
- [ ] 3.5.4 Test Memory → AI
- [ ] 3.5.5 Test Notification
- [ ] 3.5.6 Test privacy (không lộ dữ liệu private)

### 3.6 Bug Fix — Chỉ ưu tiên Critical/High

- [ ] 3.6.1 Fix UI bugs (main flow ổn)
- [ ] 3.6.2 Fix API bugs (main API ổn)
- [ ] 3.6.3 Fix AI bugs (AI sử dụng được)

### 3.7 Demo / Release MVP

- [ ] 3.7.1 Chuẩn bị dữ liệu demo (có family mẫu)
- [ ] 3.7.2 Smoke test (core flow pass)
- [ ] 3.7.3 Build release (build thành công)
- [ ] 3.7.4 Deploy (demo environment — hosting decision needed by this
      sprint at the latest, see `docs/04-devops/deployment.md`)
- [ ] 3.7.5 Demo / nghiệm thu MVP (kết thúc project)

## Notes

- Notification delivery is in-app only for MVP (list + badge) — **confirmed
  as a decision 2026-08-20**, push deferred; see `project-status.md` →
  Important Decisions for why, and for the two things that get most of the
  value without it (polling while open, local reminders for 3.2).
  **Backend for 3.1 is done**: the API and the event triggers both ship;
  what is left in 3.1 is entirely frontend.
- Deployment target must be decided before 3.7.4 — currently entirely open.

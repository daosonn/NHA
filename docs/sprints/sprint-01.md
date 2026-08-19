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

- [x] 1.1.1 UI đăng ký (form đăng ký) — done 2026-08-18: nối
      `POST /auth/register`, token vào expo-secure-store, có loading + lỗi
      theo status (409 = email đã tồn tại). verify: typecheck + prettier + check:i18n + static export, và replay thật vào API đang chạy. **Chưa chạy thử trên máy
      thật.**
- [x] 1.1.2 API đăng ký (tạo tài khoản) — done 2026-08-17: merged in PR #2
- [x] 1.1.3 Validate dữ liệu (email/password) — done 2026-08-17: DTO +
      class-validator behind global ValidationPipe, merged in PR #2
- [x] 1.1.4 UI đăng nhập (form login) — done 2026-08-18: nối
      `POST /auth/login`, refresh-on-401 gộp single-flight (đã xác nhận
      refresh token dùng lại lần 2 trả 401), "Keep me signed in" quyết định
      có lưu xuống keychain hay không. verify: typecheck + prettier + check:i18n + static export, và replay thật vào API đang chạy. **Chưa chạy thử trên máy thật.**
- [x] 1.1.5 API đăng nhập (JWT access + refresh — see backend architecture)
      — done 2026-08-17: merged in PR #2
- [x] 1.1.6 Đăng xuất (revoke refresh token) — done 2026-08-17: single-use
      refresh rotation + revoke on logout, merged in PR #2
- [ ] 1.1.7 Khôi phục mật khẩu (quên mật khẩu — `PasswordResetToken`; added 2026-08-14, see `database.md`) — API done 2026-08-18 (PR #12); 3 màn UI đã có nhưng **chưa nối**
- [x] 1.1.8 Google login (OAuth authorization code, `OAuthAccount` — customer requirement, added 2026-08-17; see `02-backend/architecture.md`) — done 2026-08-18: backend merged in PR #3, happy path verified end-to-end với credentials thật (consent screen External + test user)
- [ ] 1.1.9 Facebook login (chung flow OAuth với 1.1.8 — added 2026-08-17; LINE deferred chờ quyền email, X phase 2) — backend merged in PR #3; chờ verify E2E (cần accept tester role trên Meta app)

### 1.2 Nav1 – Trang chủ — Trang chính sau login

- [ ] 1.2.1 Navigation chính (Nav1/Nav2/Nav3/Nav4)
- [x] 1.2.2 Layout Home (responsive, mobile-first 375–430px) — done
      2026-08-18: nối `GET /families` kèm loading / error / "chưa có gia
      đình nào". Widget dịp đặc biệt (1.2.5) và recommendations vẫn là
      fixture vì chưa có endpoint. verify: typecheck + prettier + check:i18n + static export, và replay thật vào API đang chạy.
- [ ] 1.2.3 Load bài viết gần đây (feed cơ bản) — API done 2026-08-18:
      `GET /api/families/:familyId/posts`. UI **đã nối nhưng ở màn riêng**
      (`app/moments.tsx`, vào từ dòng "Swipe up for moments" trên Home) —
      chưa nhúng vào chính màn Home, nên chưa tick.
- [ ] 1.2.4 Empty/loading state (UI đầy đủ) — done cho Home, cây gia phả,
      post detail và Omoide (2026-08-18). Còn Life Profile và AI — hai màn
      chưa nối API.
- [ ] 1.2.5 Widget dịp đặc biệt trên Home (countdown + theme — sinh nhật/ngày giỗ derived từ LifeProfile; added 2026-08-14, see `database.md`)

### 1.3 Tạo nhóm gia đình — Family Group

- [x] 1.3.1 DB Family Group (Family + FamilyMember — incl. placeholder
      members, see `database.md`) — done 2026-08-14: full-MVP schema,
      25 models + migration, merged in PR #1
- [x] 1.3.2 UI tạo nhóm (nhập tên nhóm) — done 2026-08-18:
      `app/create-family.tsx` gộp cả tạo mới và tham gia bằng invite code;
      404 = mã sai, 409 = đã là thành viên, cả hai đã replay vào API thật.
      **Chưa chạy thử trên máy thật.**
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
- [x] 1.4.2 Render Family Tree (hiển thị quan hệ) — done 2026-08-18: nối
      `GET /families/:id/tree`. API trả cạnh phẳng còn component nhận cây
      đã dựng, nên có adapter `features/family/tree-from-graph.ts`: thế hệ
      tính theo khoảng cách tới gốc, rồi kéo vợ/chồng về ngang hàng (người
      cưới vào không có cha mẹ trong cây nên nếu không kéo sẽ trôi lên hàng
      trên cùng). Đã chạy adapter trên một gia đình 3 thế hệ dựng thật qua
      API. Thêm thành viên ngay trong cây (tạo placeholder + tạo cạnh).
      **Chưa chạy thử trên máy thật.**
- [x] 1.4.3 Click member → Profile (điều hướng profile) — done 2026-08-18.
      Áp dụng cho **mọi avatar**, không riêng cây: node cây, tác giả bài,
      tác giả comment. `use-member-for-user.ts` quy đổi `authorUserId`
      sang member id; trả `null` khi người đó không thuộc family đang xem,
      lúc đó avatar để trơ thay vì dẫn tới chỗ không tồn tại. Màn
      `member/[id]` vẫn là fixture — chờ `LifeEvent` + `Memo`.

### 1.5 Nav2.5 – Bài viết / Ảnh / Sự kiện — Tạo nội dung

- [x] 1.5.1 UI Create Post (nhập nội dung) — done 2026-08-18: chọn ảnh/
      video bằng `expo-image-picker`, upload **tuần tự** từng file rồi
      `POST /posts` (một moment có thể mang cả chục file ≤100MB; song song
      chỉ làm mọi file chậm hơn và biến lỗi giữa chừng thành câu đố).
      **Chưa chạy thử trên máy thật** — picker là API native, browser chỉ
      xấp xỉ.
- [x] 1.5.2 API Post (create/edit/delete) — done 2026-08-18: PostModule
      (`POST/GET/PATCH/DELETE /api/posts`), chỉ tác giả sửa/xóa; post
      private trả 404 nhất quán trên mọi verb; PATCH re-check membership
      hiện tại (ex-member chỉ còn quyền rút post về private). Verified
      lint/build + live smoke test thủ công (chưa có automated test cho
      module — jest vẫn là scaffold specs); review 2026-08-18 đã fix các
      lỗi date/authz. UI nối 2026-08-18 (1.5.1)
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
      UI nối 2026-08-18: audience picker đọc `GET /families` thật, dòng
      chữ dưới nút luôn nói rõ hậu quả (riêng tư / tất cả / bỏ qua family
      nào)
- [x] 1.5.6 Comment bài đăng (API + UI — added 2026-08-14, see
      `database.md`) — API done 2026-08-18: CRUD
      `/api/posts/:postId/comments` (ai xem được post thì comment được;
      chỉ tác giả comment sửa/xóa — quyền xóa của chủ post là product
      call chưa quyết). **UI done 2026-08-18**: `app/post/[id].tsx`, thread
      cũ-trước (ngược với feed, do server quyết), phân trang cursor, viết
      comment mới. Sửa/xóa comment chưa có UI.
- [x] 1.5.7 Reaction bài đăng (đa dạng loại — added 2026-08-14, see
      `database.md`) — API done 2026-08-18: `PUT/DELETE
/api/posts/:postId/reactions/me` (upsert 1 reaction/người/bài,
      LIKE/LOVE/HAHA/WOW/SAD); PostDetail có thêm
      commentCount/reactionCount/myReaction. **UI done 2026-08-18**: 5 icon
      Lucide, cập nhật optimistic rồi đối chiếu với `ReactionState` server
      trả về. Đã xác nhận `PUT LOVE` sau `PUT LIKE` **thay thế** chứ không
      cộng thêm — phép tính optimistic dựa vào đúng điều này.

### 1.6 Nav4 – Hồ sơ đời cá nhân — Profile

> **Nhóm chặn nhiều nhất tính đến 2026-08-18.** `GET/PATCH /me/profile` và
> route profile theo member đã có (PR #9), nhưng màn Life Profile có ba tab
> mà cả ba đều thiếu endpoint: Timeline cần `LifeEvent` (1.6.8), Memo cần
> `Memo` (1.6.5), Album cần gallery derived (1.6.4). Nối riêng phần header
>
> - About bây giờ sẽ cho ra một màn trung tâm với ba tab trống, nên frontend
>   đợi. Thứ tự mở khoá đề xuất: `LifeEvent` → `Memo` → gallery.

- [ ] 1.6.1 UI Profile (avatar + tên) — UI xong 2026-08-18 (mock data, chưa nối API)
- [ ] 1.6.2 About (thông tin cá nhân) — API done 2026-08-18:
      `GET/PATCH /api/me/profile` +
      `GET/PATCH /api/families/:familyId/members/:memberId/profile`
      (display rule linked→global / placeholder→wiki; placeholder
      wiki-editable bởi cả nhà, mọi edit ghi `EditHistory`; bio,
      interests, birthDate/deathDate — nguồn cho widget 1.2.5).
      UI xong 2026-08-18 (mock data, chưa nối API)
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

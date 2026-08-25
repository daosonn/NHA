# Nền thiệp màn 26 (assets/card-templates)

15 nền thiệp hoa màu nước do **Sơn (AI team) tự thiết kế** — tài sản của dự án,
được commit thẳng vào repo (khác với `assets/music/` vốn bị gitignore): tổng
~2.4MB, không có lý do bắt người clone đi tải lại.

- Khổ chuẩn **1080×1440 (3:4)** — đúng khổ PNG mà `CardService` render.
- Đặt tên `tXX.jpg` theo số thứ tự trong bộ thiết kế gốc (t08/t14 không tồn tại).
- Mỗi nền có **vùng trống dành cho chữ** khác nhau (giữa / trên / dưới / lệch
  phải) — khai báo trong bảng `TEMPLATES` của
  `apps/api/src/ai/card.service.ts`, mobile giữ bản sao trong
  `apps/mobile/app/ai/card.tsx`. Thêm nền mới = thêm file + 1 dòng vào cả hai
  bảng + 2 key i18n `ai.card.template.<id>`.
- Mobile lấy ảnh nền qua `GET /cards/templates/:id/image` (public, cache 1
  ngày — cùng lý do route nhạc thư viện là public: asset của app, không phải
  dữ liệu người dùng).

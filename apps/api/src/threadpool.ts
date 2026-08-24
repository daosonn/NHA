import os from 'node:os';

/**
 * Nới threadpool của libuv trước khi có ai kịp dùng nó.
 *
 * Node mặc định cho **4** thread cho mọi việc chặn phải đẩy ra khỏi event loop:
 * đọc/ghi file, và `sharp` thu nhỏ ảnh. Bốn chỗ đó là chung cho cả API, nên một
 * người đăng bài (5 ảnh × thu nhỏ để gửi AI đọc) chiếm hết, và người khác chỉ
 * đang xem ảnh trong album cũng phải đợi — dù CPU còn rảnh 12 luồng.
 *
 * Đặt bằng số nhân của máy, chặn trên ở 16: quá số nhân thì thread chỉ giành
 * CPU của nhau chứ không nhanh hơn.
 *
 * Vì sao là một file riêng được import ĐẦU TIÊN: libuv đọc biến này lúc khởi
 * tạo threadpool, tức lần đầu có việc được đẩy vào. `import` biên dịch thành
 * `require` chạy theo thứ tự, nên file này phải nằm trên `sharp` và trên mọi
 * thứ chạm tới file — gán trong thân `bootstrap()` là đã muộn.
 *
 * Biến môi trường thật (đặt ngoài, lúc chạy) luôn thắng: ở đây chỉ điền khi
 * chưa ai nói gì. Lưu ý `.env` KHÔNG dùng được cho việc này — Nest đọc `.env`
 * sau khi tiến trình đã chạy, quá muộn.
 */
const CEILING = 16;

if (
  process.env.UV_THREADPOOL_SIZE === undefined ||
  process.env.UV_THREADPOOL_SIZE.trim() === ''
) {
  const size = Math.max(4, Math.min(CEILING, os.cpus().length));
  process.env.UV_THREADPOOL_SIZE = String(size);
}

// Thời lượng card MỞ ĐẦU / card KẾT — GIÃN THEO ĐỘ DÀI lời dẫn.
// Lời dẫn giờ là 2-4 câu (70-140 ký tự), đọc không kịp nếu giữ 4s/3s cứng như bản cũ.
// Ước lượng: tiếng Nhật đọc thoải mái ~7 ký tự/giây, cộng thời gian hoạt cảnh vào/ra.
//
// File này CỐ Ý không import gì (không sharp, không sqlite) để CẢ server (pipeline render)
// và client (nhãn "~Ns" trong Studio) dùng đúng một công thức — trước đây UI ước lượng
// 4s/3s cứng nên hiện sai thời lượng.

import type { IntroTemplateId } from './types';

/** Card gradient trơn (intro 'none') — không có lời dẫn nên giữ ngắn */
export const CARD_SEC = 3;

/** Đếm "đơn vị chữ": 1 ký tự Nhật ≈ 1, ký tự Latin ≈ 0.55 (đọc nhanh hơn) */
export function jaUnits(s: string): number {
  return Array.from(s ?? '').reduce((a, ch) => a + (/[　-ヿ㐀-鿿＀-￯]/.test(ch) ? 1 : 0.55), 0);
}

/** Mở đầu: hoạt cảnh ~2.6s + thời gian đọc lời dẫn; ✉️ letter gõ từng chữ nên cần dư hơn */
export function introSecondsFor(openingJa: string, template: IntroTemplateId): number {
  const read = jaUnits(openingJa) / (template === 'letter' ? 5.5 : 7);
  return Math.min(14, Math.max(5, Math.round((2.6 + read) * 10) / 10));
}

/** Card kết: câu kết + lời đề tặng + dòng ghi công hiện so le → cần đọc hết rồi mới tắt */
export function outroSecondsFor(closingJa: string, dedicationJa: string): number {
  const read = (jaUnits(closingJa) + jaUnits(dedicationJa) * 0.6) / 7;
  return Math.min(13, Math.max(5, Math.round((2.4 + read) * 10) / 10));
}

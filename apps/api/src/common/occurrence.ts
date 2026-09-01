/**
 * MỘT bộ não occurrence cho ngày đặc biệt — widget (special-date.service) và
 * nhắc hẹn (reminder.service) cùng import từ đây, để ngày hiển thị và ngày
 * bắn thông báo không bao giờ lệch nhau (trước 2026-09-01 mỗi bên giữ một
 * bản chép tay của cùng logic Feb-29).
 *
 * Bốn nhánh:
 *  - dương, lặp hằng năm: Date.UTC overflow — Feb 29 năm thường TRÔI TỚI Mar 1
 *    (hành vi cũ, giữ nguyên);
 *  - âm, lặp hằng năm: nextLunarOccurrence — tháng nhuận bỏ qua, ngày 30 của
 *    tháng 29 ngày KẸP LÙI 29 (giỗ theo ngày cuối tháng);
 *  - dương, một lần: đúng ngày của đúng năm đó;
 *  - âm, một lần: year là năm ÂM lịch, đổi qua lunarOneOffSolarDate.
 * Một-lần đã qua (hoặc không tồn tại) → null: biến mất khỏi danh sách và
 * không bao giờ nhắc.
 */

import { lunarOneOffSolarDate, nextLunarOccurrence } from './lunar';

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface OccurrenceSpec {
  month: number;
  day: number;
  isLunar: boolean;
  repeatsYearly: boolean;
  /** Chỉ cho một-lần; theo lịch của chính spec (âm cho isLunar). */
  year: number | null;
}

/** Nửa đêm UTC hôm nay — mọi phép đếm ngày trong app so trên mốc này. */
export function todayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * Ngày (UTC midnight) của lần xuất hiện kế tiếp tính từ `today` trở đi,
 * hoặc null (một-lần đã qua / ngày không tồn tại).
 */
export function nextOccurrenceOf(
  spec: OccurrenceSpec,
  today: Date,
): Date | null {
  if (!spec.repeatsYearly) {
    if (spec.year === null) {
      return null; // dữ liệu hỏng — một-lần bắt buộc có năm (DTO chặn từ ngoài)
    }
    const date = spec.isLunar
      ? lunarOneOffSolarDate(spec.year, spec.month, spec.day)
      : new Date(Date.UTC(spec.year, spec.month - 1, spec.day));
    if (date === null || date.getTime() < today.getTime()) {
      return null;
    }
    return date;
  }
  if (spec.isLunar) {
    return nextLunarOccurrence(spec.month, spec.day, today);
  }
  // Dương lặp hằng năm — nguyên văn hành vi cũ: Date.UTC overflow nghĩa là
  // 29/2 năm thường thành 1/3, và ngày đó vẫn "trong năm nay" nếu chưa qua.
  const year = today.getUTCFullYear();
  const thisYear = new Date(Date.UTC(year, spec.month - 1, spec.day));
  if (thisYear.getTime() >= today.getTime()) {
    return thisYear;
  }
  return new Date(Date.UTC(year + 1, spec.month - 1, spec.day));
}

/**
 * Ngày `target` có đúng là một lần xuất hiện của spec không — định nghĩa
 * QUA nextOccurrenceOf để kẹp/trôi ngày không bao giờ lệch giữa hai phía.
 */
export function occursOn(spec: OccurrenceSpec, target: Date): boolean {
  const next = nextOccurrenceOf(spec, target);
  return next !== null && next.getTime() === target.getTime();
}

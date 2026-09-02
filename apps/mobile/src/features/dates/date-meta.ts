import type { TFunction } from 'i18next';

import type { SpecialDateItem } from '../../lib/api';
import { formatDayMonth } from '../../lib/date';

/**
 * Chữ phụ của một hàng ngày ("in 11 days · …" — nửa sau):
 *  - lunar → "lunar 10/2" (tháng/ngày ÂM lưu trong item, không phải ngày dương);
 *  - variant 'kind' (12a) → tên loại ("birthday");
 *  - variant 'repeat' (12b) → "every year" | "once".
 */
export function dateRowMeta(
  item: Pick<SpecialDateItem, 'isLunar' | 'repeatsYearly' | 'month' | 'day'>,
  t: TFunction,
  variant: 'kind' | 'repeat',
  kindLabel: string,
): string {
  if (item.isLunar) {
    return t('dates.meta.lunar', { month: item.month, day: item.day });
  }
  if (variant === 'kind') {
    return kindLabel;
  }
  return (item.repeatsYearly ?? true)
    ? t('dates.meta.everyYear')
    : t('dates.meta.once');
}

/**
 * Label dịp cho deep-link sang gift/message — PHẢI ghép đúng công thức của
 * OccasionSheet và AI hub (`label · dayMonth`): cache gợi ý của server key
 * theo label (message) nên lệch một byte là một lượt gọi AI trả tiền; rồi
 * cắt 80 vì DTO chặn @MaxLength(80) (title CUSTOM được phép tới 120).
 */
export function occasionParam(
  item: Pick<SpecialDateItem, 'nextOccurrence'>,
  label: string,
): string {
  const dayMonth = formatDayMonth(item.nextOccurrence);
  return `${label}${dayMonth ? ` · ${dayMonth}` : ''}`.slice(0, 80);
}

/** Theme suy từ loại — client tự quyết, form không hỏi (mockup 12c không có
 *  ô theme): sinh nhật = nến, giỗ = viền hoa, còn lại cờ dây. */
export function themeFor(type: SpecialDateItem['type']): string {
  switch (type) {
    case 'BIRTHDAY':
      return 'CONFETTI_CANDLES';
    case 'MEMORIAL':
      return 'FLORAL_BORDER';
    default:
      return 'BUNTING';
  }
}

/** Thứ trong tuần của `YYYY-MM-DD`, parse tay để ngày không trôi múi giờ
 *  (cùng lý do với src/lib/date.ts). 0 = Chủ nhật, khớp date.weekdays.*. */
export function weekdayIndex(isoDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

/**
 * Ngày/tháng DƯƠNG để vẽ DateTile — luôn từ `nextOccurrence`, không bao giờ
 * từ `item.month/day`: với dòng ÂM lịch, month/day là tháng/ngày ÂM (giỗ
 * lunar 10/2 phải lên ô "06 Oct", không phải "02 Oct" của tháng 10 dương).
 */
export function tileDayMonth(
  item: Pick<SpecialDateItem, 'nextOccurrence' | 'month' | 'day'>,
): { day: number; month: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(item.nextOccurrence);
  if (!m) return { day: item.day, month: item.month };
  return { day: Number(m[3]), month: Number(m[2]) };
}

/**
 * Params mở màn chi tiết (12d) cho một item — CUSTOM đi bằng id dòng;
 * DERIVED không có id nên id là chữ 'derived' và danh tính đi theo params
 * (bộ ba familyId+memberId+type là duy nhất cho một dòng derived;
 * nextOccurrence chỉ để vẽ trước khi query về, không phải khoá — sang năm
 * nó đổi và sẽ mồ côi link).
 */
export function dateDetailParams(
  item: Pick<SpecialDateItem, 'id' | 'type' | 'nextOccurrence' | 'members'> & {
    familyId: string | null;
    scope: 'FAMILY' | 'PERSONAL';
  },
): { id: string } & Record<string, string> {
  if (item.id != null) {
    return { id: item.id, familyId: item.familyId ?? '', scope: item.scope };
  }
  return {
    id: 'derived',
    familyId: item.familyId ?? '',
    memberId: item.members[0]?.memberId ?? '',
    type: item.type,
    next: item.nextOccurrence,
  };
}

/** Props sẵn cho <DateTile {...tileDayMonthProps(item, t)} /> — hub và
 *  occasion sheet dùng chung để khỏi lặp lại lỗi vẽ tháng âm lên ô. */
export function tileDayMonthProps(
  item: Pick<SpecialDateItem, 'nextOccurrence' | 'month' | 'day'>,
  t: TFunction,
): { day: number; month: string } {
  const tile = tileDayMonth(item);
  return { day: tile.day, month: t(`date.months.${tile.month}`) };
}

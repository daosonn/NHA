import {
  convertLunar2Solar,
  convertSolar2Lunar,
  lunarOneOffSolarDate,
  nextLunarOccurrence,
} from './lunar';

/** So sánh gọn: {day, month, year} → 'YYYY-MM-DD'. */
function iso(d: { day: number; month: number; year: number } | null): string {
  if (d === null) return 'null';
  const mm = String(d.month).padStart(2, '0');
  const dd = String(d.day).padStart(2, '0');
  return `${d.year}-${mm}-${dd}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe('lunar (âm lịch Việt Nam, tz +7)', () => {
  // Mốc Tết công khai, kiểm được bằng bất kỳ lịch vạn niên VN nào.
  const TET: Array<[number, string]> = [
    [2024, '2024-02-10'],
    [2025, '2025-01-29'],
    [2026, '2026-02-17'],
    [2027, '2027-02-06'],
  ];

  it.each(TET)('Tết năm âm %i = %s (lunar 1/1 → solar)', (ly, solar) => {
    expect(iso(convertLunar2Solar(1, 1, ly, false))).toBe(solar);
  });

  it.each(TET)('solar %s → lunar 1/1 của năm âm tương ứng', (ly, solar) => {
    const [y, m, d] = solar.split('-').map(Number);
    expect(convertSolar2Lunar(d, m, y)).toEqual({
      day: 1,
      month: 1,
      year: ly,
      leap: false,
    });
  });

  it('Trung thu 8/15 âm 2025 = 2025-10-06', () => {
    expect(iso(convertLunar2Solar(15, 8, 2025, false))).toBe('2025-10-06');
  });

  it('Vu Lan 7/15 âm 2025 = 2025-09-06', () => {
    expect(iso(convertLunar2Solar(15, 7, 2025, false))).toBe('2025-09-06');
  });

  describe('năm nhuận Ất Tỵ 2025 (nhuận tháng 6)', () => {
    it('tồn tại một ngày dương mà lunar trả về leap=true tháng 6', () => {
      // Tháng 6 thường 2025 bắt đầu ~25/06; tháng 6 nhuận bắt đầu ~25/07.
      const inLeap = convertSolar2Lunar(1, 8, 2025);
      expect(inLeap.month).toBe(6);
      expect(inLeap.leap).toBe(true);
    });

    it('xin tháng 6 nhuận qua convertLunar2Solar(leap=true) vẫn giải được, còn năm không nhuận thì null', () => {
      expect(convertLunar2Solar(1, 6, 2025, true)).not.toBeNull();
      expect(convertLunar2Solar(1, 6, 2026, true)).toBeNull();
    });

    it('ngày lặp hằng năm rơi giữa hai tháng 6: nextLunarOccurrence chỉ chọn tháng THƯỜNG', () => {
      // Đứng ngay sau tháng 6 thường 2025 (đang trong tháng 6 nhuận):
      // lần kế tiếp của 6/10 âm phải là tháng 6 thường của năm âm SAU,
      // không phải ngày 10 của tháng 6 nhuận đang diễn ra.
      const todayInLeap = new Date(Date.UTC(2025, 7, 5)); // 2025-08-05, lunar leap-6
      const next = nextLunarOccurrence(6, 10, todayInLeap);
      const back = convertSolar2Lunar(
        next.getUTCDate(),
        next.getUTCMonth() + 1,
        next.getUTCFullYear(),
      );
      expect(back).toEqual({ day: 10, month: 6, year: 2026, leap: false });
    });
  });

  describe('giỗ lunar 10/2', () => {
    it('năm âm 2026: rơi vào tháng 11 dương 2026 và round-trip đúng', () => {
      const solar = convertLunar2Solar(2, 10, 2026, false);
      expect(solar).not.toBeNull();
      expect(solar!.year).toBe(2026);
      expect(solar!.month).toBe(11);
      const back = convertSolar2Lunar(solar!.day, solar!.month, solar!.year);
      expect(back).toEqual({ day: 2, month: 10, year: 2026, leap: false });
    });
  });

  describe('kẹp ngày 30 của tháng 29 ngày', () => {
    it('convertLunar2Solar trả null cho ngày 30 không tồn tại (round-trip bắt được)', () => {
      // Tìm một tháng 29 ngày trong năm âm 2025 rồi khẳng định hành vi.
      let found = false;
      for (let m = 1; m <= 12 && !found; m += 1) {
        const d30 = convertLunar2Solar(30, m, 2025, false);
        if (d30 === null) {
          found = true;
          // nextLunarOccurrence với ngày 30 tháng đó phải kẹp về 29
          const start = convertLunar2Solar(1, m, 2025, false)!;
          const today = new Date(
            Date.UTC(start.year, start.month - 1, start.day),
          );
          const next = nextLunarOccurrence(m, 30, today);
          const back = convertSolar2Lunar(
            next.getUTCDate(),
            next.getUTCMonth() + 1,
            next.getUTCFullYear(),
          );
          expect(back.day).toBe(29);
          expect(back.month).toBe(m);
        }
      }
      expect(found).toBe(true); // năm âm nào cũng có tháng 29 ngày
    });

    it('lunarOneOffSolarDate kẹp ngày 30 thiếu về 29 thay vì trả null', () => {
      for (let m = 1; m <= 12; m += 1) {
        if (convertLunar2Solar(30, m, 2025, false) === null) {
          const clamped = lunarOneOffSolarDate(2025, m, 30);
          expect(clamped).not.toBeNull();
          const back = convertSolar2Lunar(
            clamped!.getUTCDate(),
            clamped!.getUTCMonth() + 1,
            clamped!.getUTCFullYear(),
          );
          expect(back.day).toBe(29);
          return;
        }
      }
      throw new Error('không tìm thấy tháng 29 ngày trong năm âm 2025');
    });
  });

  it('round-trip solar → lunar → solar giữ nguyên, lấy mẫu 1900–2100', () => {
    // Bước nhảy 97 ngày (nguyên tố, lệch pha với tháng) quét đủ mọi cấu hình.
    const start = Date.UTC(1900, 0, 1);
    const end = Date.UTC(2100, 11, 31);
    for (let t = start; t <= end; t += 97 * 24 * 60 * 60 * 1000) {
      const date = new Date(t);
      const [y, m, d] = [
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
      ];
      const lunar = convertSolar2Lunar(d, m, y);
      const solar = convertLunar2Solar(
        lunar.day,
        lunar.month,
        lunar.year,
        lunar.leap,
      );
      expect(iso(solar)).toBe(iso({ day: d, month: m, year: y }));
    }
  });

  it('nextLunarOccurrence: đúng hôm nay thì trả hôm nay; đã qua thì sang năm âm sau', () => {
    // Tết 2026 = 2026-02-17
    const tet2026 = new Date(Date.UTC(2026, 1, 17));
    expect(isoDate(nextLunarOccurrence(1, 1, tet2026))).toBe('2026-02-17');
    const dayAfter = new Date(Date.UTC(2026, 1, 18));
    expect(isoDate(nextLunarOccurrence(1, 1, dayAfter))).toBe('2027-02-06');
  });
});

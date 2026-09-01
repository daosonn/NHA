import { nextOccurrenceOf, occursOn, OccurrenceSpec } from './occurrence';

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoOf(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}

const solarYearly = (month: number, day: number): OccurrenceSpec => ({
  month,
  day,
  isLunar: false,
  repeatsYearly: true,
  year: null,
});

describe('nextOccurrenceOf', () => {
  describe('dương, lặp hằng năm (hành vi cũ giữ nguyên)', () => {
    it('hôm nay là đúng ngày → hôm nay', () => {
      expect(isoOf(nextOccurrenceOf(solarYearly(9, 15), d('2026-09-15')))).toBe(
        '2026-09-15',
      );
    });

    it('vừa qua hôm qua → năm sau', () => {
      expect(isoOf(nextOccurrenceOf(solarYearly(9, 15), d('2026-09-16')))).toBe(
        '2027-09-15',
      );
    });

    it('Feb 29 ở năm thường TRÔI TỚI Mar 1 (Date.UTC overflow, đúng bản cũ)', () => {
      expect(isoOf(nextOccurrenceOf(solarYearly(2, 29), d('2026-02-15')))).toBe(
        '2026-03-01',
      );
      // Năm nhuận thì đúng 29/2.
      expect(isoOf(nextOccurrenceOf(solarYearly(2, 29), d('2028-01-15')))).toBe(
        '2028-02-29',
      );
    });
  });

  describe('âm, lặp hằng năm', () => {
    const tet: OccurrenceSpec = {
      month: 1,
      day: 1,
      isLunar: true,
      repeatsYearly: true,
      year: null,
    };

    it('Tết kế tiếp từ 2026-09-01 là 2027-02-06', () => {
      expect(isoOf(nextOccurrenceOf(tet, d('2026-09-01')))).toBe('2027-02-06');
    });

    it('đứng đúng ngày Tết thì trả chính nó', () => {
      expect(isoOf(nextOccurrenceOf(tet, d('2026-02-17')))).toBe('2026-02-17');
    });
  });

  describe('một lần', () => {
    const oneOff: OccurrenceSpec = {
      month: 5,
      day: 19,
      isLunar: false,
      repeatsYearly: false,
      year: 2027,
    };

    it('tương lai → đúng ngày của đúng năm', () => {
      expect(isoOf(nextOccurrenceOf(oneOff, d('2026-09-01')))).toBe(
        '2027-05-19',
      );
    });

    it('đúng hôm đó → hôm đó; đã qua → null (biến khỏi list, không nhắc)', () => {
      expect(isoOf(nextOccurrenceOf(oneOff, d('2027-05-19')))).toBe(
        '2027-05-19',
      );
      expect(nextOccurrenceOf(oneOff, d('2027-05-20'))).toBeNull();
    });

    it('một lần thiếu năm (dữ liệu hỏng) → null, không nổ', () => {
      expect(
        nextOccurrenceOf(
          { month: 5, day: 19, isLunar: false, repeatsYearly: false, year: null },
          d('2026-09-01'),
        ),
      ).toBeNull();
    });

    it('một lần ÂM: year là năm âm — giỗ đầu 10/2 âm 2026 ra tháng 11 dương 2026', () => {
      const next = nextOccurrenceOf(
        { month: 10, day: 2, isLunar: true, repeatsYearly: false, year: 2026 },
        d('2026-09-01'),
      );
      expect(next).not.toBeNull();
      expect(next!.getUTCFullYear()).toBe(2026);
      expect(next!.getUTCMonth() + 1).toBe(11);
    });
  });
});

describe('occursOn ⟺ nextOccurrenceOf(spec, target) === target', () => {
  it('dương thường: đúng ngày true, lệch một ngày false', () => {
    expect(occursOn(solarYearly(9, 15), d('2026-09-15'))).toBe(true);
    expect(occursOn(solarYearly(9, 15), d('2026-09-14'))).toBe(false);
  });

  it('Feb 29: năm thường "xảy ra" vào 1/3, không phải 28/2', () => {
    expect(occursOn(solarYearly(2, 29), d('2026-03-01'))).toBe(true);
    expect(occursOn(solarYearly(2, 29), d('2026-02-28'))).toBe(false);
    expect(occursOn(solarYearly(2, 29), d('2028-02-29'))).toBe(true);
  });

  it('âm: Tết 2027 xảy ra đúng 2027-02-06', () => {
    const tet: OccurrenceSpec = {
      month: 1,
      day: 1,
      isLunar: true,
      repeatsYearly: true,
      year: null,
    };
    expect(occursOn(tet, d('2027-02-06'))).toBe(true);
    expect(occursOn(tet, d('2027-02-05'))).toBe(false);
  });

  it('một lần: chỉ đúng năm đó', () => {
    const spec: OccurrenceSpec = {
      month: 5,
      day: 19,
      isLunar: false,
      repeatsYearly: false,
      year: 2027,
    };
    expect(occursOn(spec, d('2027-05-19'))).toBe(true);
    expect(occursOn(spec, d('2028-05-19'))).toBe(false);
  });
});

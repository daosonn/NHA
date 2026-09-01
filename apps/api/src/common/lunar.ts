/**
 * Âm lịch Việt Nam — thuật toán Hồ Ngọc Đức (astronomical new-moon + solar
 * longitude), thuần số học, không dependency.
 *
 * Múi giờ CỐ ĐỊNH +7: lịch âm Việt Nam được định nghĩa theo nửa đêm UTC+7
 * (đây chính là chỗ lịch Việt lệch lịch Trung — họ dùng +8; giỗ/Tết tính
 * theo +8 có thể sai một ngày, thậm chí một tháng ở năm nhuận).
 *
 * Hai quy tắc sản phẩm sống ở tầng trên (occurrence.ts) chứ không ở đây,
 * nhưng nhắc trước vì test neo chúng:
 *  - Ngày lặp hằng năm rơi vào THÁNG NHUẬN: luôn dùng tháng thường.
 *  - Ngày 30 của tháng chỉ có 29 ngày: KẸP LÙI về 29 (giỗ theo ngày cuối
 *    tháng) — cố ý ngược với Feb 29 dương lịch (đẩy TỚI Mar 1, giữ nguyên
 *    hành vi cũ của special-date.service).
 */

const VN_TZ = 7;

/** INT() của thuật toán gốc — floor, kể cả số âm. */
function INT(d: number): number {
  return Math.floor(d);
}

/** Julian day number của một ngày dương lịch (giờ địa phương bất kỳ). */
export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    INT((153 * m + 2) / 5) +
    365 * y +
    INT(y / 4) -
    INT(y / 100) +
    INT(y / 400) -
    32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

/** Ngày dương lịch của một Julian day number. */
export function jdToDate(jd: number): {
  day: number;
  month: number;
  year: number;
} {
  let a: number;
  let b: number;
  let c: number;
  if (jd > 2299160) {
    // sau cải cách Gregory
    a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  return {
    day: e - INT((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * INT(m / 10),
    year: b * 100 + d - 4800 + INT(m / 10),
  };
}

/** Ngày (jdn, đã làm tròn theo múi giờ) của điểm sóc thứ k kể từ 1/1/1900. */
function getNewMoonDay(k: number, timeZone: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 =
    C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 =
    C1 -
    0.0004 * Math.sin(dr * (2 * F - M)) -
    0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 =
    C1 +
    0.001 * Math.sin(dr * (2 * F - Mpr)) +
    0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat: number;
  if (T < -11) {
    deltat =
      0.001 +
      0.000839 * T +
      0.0002261 * T2 -
      0.00000845 * T3 -
      0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  const JdNew = Jd1 + C1 - deltat;
  return INT(JdNew + 0.5 + timeZone / 24);
}

/** Cung hoàng đạo (0-11) của mặt trời vào đầu ngày jdn theo múi giờ. */
function getSunLongitude(jdn: number, timeZone: number): number {
  const T = (jdn - 2451545.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL =
    DL +
    (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) +
    0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - Math.PI * 2 * INT(L / (Math.PI * 2));
  return INT((L / Math.PI) * 6);
}

/** Điểm sóc bắt đầu tháng 11 âm (tháng chứa đông chí) của năm dương yy. */
function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

/** Vị trí tháng nhuận (offset kể từ tháng 11 âm đứng đầu năm âm lịch). */
function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i += 1;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  leap: boolean;
}

/** Ngày âm lịch của một ngày dương lịch. */
export function convertSolar2Lunar(
  dd: number,
  mm: number,
  yy: number,
): LunarDate {
  const timeZone = VN_TZ;
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let lunarLeap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        lunarLeap = true;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth -= 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

/**
 * Ngày dương lịch của một ngày âm lịch. Trả null khi ngày âm không tồn tại
 * (ngày 30 của tháng 29 ngày, hoặc cờ nhuận sai) — kiểm bằng round-trip vì
 * thuật toán gốc trong ca đó trả về ngày tràn sang tháng sau.
 */
export function convertLunar2Solar(
  lunarDay: number,
  lunarMonth: number,
  lunarYear: number,
  lunarLeap: boolean,
): { day: number; month: number; year: number } | null {
  const timeZone = VN_TZ;
  let a11: number;
  let b11: number;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, timeZone);
    b11 = getLunarMonth11(lunarYear, timeZone);
  } else {
    a11 = getLunarMonth11(lunarYear, timeZone);
    b11 = getLunarMonth11(lunarYear + 1, timeZone);
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = lunarMonth - 11;
  if (off < 0) {
    off += 12;
  }
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) {
      leapMonth += 12;
    }
    if (lunarLeap && lunarMonth !== leapMonth) {
      return null; // xin tháng nhuận ở năm/tháng không nhuận
    }
    if (lunarLeap || off >= leapOff) {
      off += 1;
    }
  }
  const monthStart = getNewMoonDay(k + off, timeZone);
  const solar = jdToDate(monthStart + lunarDay - 1);
  // Round-trip: ngày 30 của tháng 29 ngày sẽ tràn sang mùng 1 tháng sau.
  const back = convertSolar2Lunar(solar.day, solar.month, solar.year);
  if (
    back.day !== lunarDay ||
    back.month !== lunarMonth ||
    back.leap !== lunarLeap
  ) {
    return null;
  }
  return solar;
}

/** Date UTC-midnight từ (y, m, d) dương lịch. */
function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Ngày dương (UTC midnight) của lần xuất hiện KẾ TIẾP của một ngày âm lặp
 * hằng năm, tính từ `today` (UTC midnight) trở đi.
 * Tháng nhuận bị bỏ qua (luôn tháng thường); ngày 30 thiếu → kẹp lùi 29.
 */
export function nextLunarOccurrence(
  lunarMonth: number,
  lunarDay: number,
  today: Date,
): Date {
  const t = convertSolar2Lunar(
    today.getUTCDate(),
    today.getUTCMonth() + 1,
    today.getUTCFullYear(),
  );
  // Nhiều nhất 2 năm âm là chắc chắn có (biên năm âm ±1); +2 cho an toàn.
  for (let ly = t.year; ly <= t.year + 2; ly += 1) {
    const solar =
      convertLunar2Solar(lunarDay, lunarMonth, ly, false) ??
      convertLunar2Solar(29, lunarMonth, ly, false); // kẹp lùi ngày 30 → 29
    if (solar === null) {
      continue; // không xảy ra với tháng thường hợp lệ, nhưng đừng nổ
    }
    const date = utcDate(solar.year, solar.month, solar.day);
    if (date.getTime() >= today.getTime()) {
      return date;
    }
  }
  // Không thể tới đây với input hợp lệ (1-12 / 1-30) — phòng hờ trả năm sau.
  const fallback = convertLunar2Solar(
    Math.min(lunarDay, 29),
    lunarMonth,
    t.year + 1,
    false,
  );
  return utcDate(fallback!.year, fallback!.month, fallback!.day);
}

/**
 * Ngày dương (UTC midnight) của một ngày âm MỘT LẦN (year = năm ÂM lịch),
 * tháng thường; null khi ngày âm không tồn tại (dùng cho cả validation).
 * Ngày 30 thiếu cũng kẹp lùi 29 — cùng quy tắc với bản lặp hằng năm.
 */
export function lunarOneOffSolarDate(
  lunarYear: number,
  lunarMonth: number,
  lunarDay: number,
): Date | null {
  const solar =
    convertLunar2Solar(lunarDay, lunarMonth, lunarYear, false) ??
    (lunarDay === 30 ? convertLunar2Solar(29, lunarMonth, lunarYear, false) : null);
  if (solar === null) {
    return null;
  }
  return utcDate(solar.year, solar.month, solar.day);
}

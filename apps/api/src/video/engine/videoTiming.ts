// Nhịp + hiệu ứng THÂN VIDEO kiểu "iPhone Memories" — thiết kế theo bản bóc tách
// của Sơn (artifact "Memories Transition Teardown", đo pixel trên video Ký ức thật):
//   · Cut thẳng đúng nhịp là MẶC ĐỊNH (8/19 mối nối) — hiệu ứng là dấu câu, không phải văn bản.
//   · Mọi shot nằm trên lưới nhịp nhạc: 1 shot chuẩn = 4 nhịp (90BPM → 2.667s).
//   · Ken Burns cực nhẹ (~1%/s, tổng 2-4%/shot), TUYẾN TÍNH; easing chỉ dành cho chuyển cảnh.
//   · Counter-slide là hiệu ứng chủ đạo, dùng thành CỤM cùng hướng; bloom trắng gần cuối; whip 1 lần.
//
// File này CỐ Ý thuần (không import sharp/ffmpeg/db) để UI Studio ước lượng thời lượng
// bằng ĐÚNG công thức server render — như lib/cardTiming.ts.

import type { Scene, SceneEffect } from './types';

// ---- Mối nối (join) giữa các segment ----
export type JoinType = 'cut' | 'fade' | 'fadewhite' | 'hblur' | 'counterslide';
export type Join = {
  type: JoinType;
  /** thời gian chồng lấn (giây) — cut = 0 */
  dur: number;
  /** counterslide: hướng dải TRÊN nhận ảnh mới (1 = từ phải, -1 = từ trái); dải dưới tự ngược lại */
  dir?: 1 | -1;
};

/** Thời lượng đo được từ video Memories: dissolve 0.38-0.6 · bloom ~0.8 · whip ~0.35 · slide 0.83-0.99 */
export const JOIN_DUR: Record<Exclude<JoinType, 'cut'>, number> = {
  fade: 0.5,
  fadewhite: 0.8,
  hblur: 0.35,
  counterslide: 0.95,
};

export const joinOverlap = (j: Join): number => (j.type === 'cut' ? 0 : j.dur);

// ---- Lưới nhịp ----
export const beatSec = (bpm: number): number => 60 / bpm;

/** Làm tròn về BỘI NHỊP gần nhất (min 2 nhịp). bpm null → giữ nguyên (nhạc upload / không nhạc). */
export function quantizeToBeat(sec: number, bpm: number | null): number {
  if (!bpm) return sec;
  const b = beatSec(bpm);
  const n = Math.min(16, Math.max(2, Math.round(sec / b)));
  return Math.round(n * b * 1000) / 1000;
}

/** Làm tròn LÊN bội nhịp (card mở/kết: không được ngắn hơn thời gian đọc lời dẫn). */
export function quantizeUpToBeat(sec: number, bpm: number | null): number {
  if (!bpm) return sec;
  const b = beatSec(bpm);
  return Math.round(Math.ceil(sec / b - 1e-6) * b * 1000) / 1000;
}

// ---- Ngẫu nhiên deterministic (cache segment + re-render phải ra y hệt) ----
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromIds(ids: string[]): number {
  let h = 2166136261;
  for (const ch of ids.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---- Phân bổ chuyển động trong ảnh (Ken Burns) ----
// Nguồn đo: có shot zoom in, có shot zoom out, có shot CHỈ pan ngang, có shot gần như tĩnh.
// "Không phải công thức luôn-zoom-vào — biến thể được gán theo shot."
const KB_POOL: SceneEffect[] = [
  'zoom_in',
  'pan_lr',
  'zoom_out',
  'pan_rl',
  'static',
];

/**
 * Gán hiệu ứng cho từng cảnh: deterministic theo seed, không lặp 2 shot liền kề,
 * ~1/5 shot là tĩnh. video_clip vẫn được gán nhưng renderer bỏ qua.
 */
export function assignEffects(
  scenes: Pick<Scene, 'media_id' | 'type'>[],
  seed: number,
): SceneEffect[] {
  const rnd = mulberry32(seed);
  const out: SceneEffect[] = [];
  let prev: SceneEffect | null = null;
  for (let i = 0; i < scenes.length; i++) {
    let pick: SceneEffect = KB_POOL[Math.floor(rnd() * KB_POOL.length)];
    // tránh lặp liền kề (thử lại tối đa 4 lần — deterministic vì rnd deterministic)
    for (let k = 0; k < 4 && pick === prev; k++)
      pick = KB_POOL[Math.floor(rnd() * KB_POOL.length)];
    if (pick === prev)
      pick = KB_POOL[(KB_POOL.indexOf(pick) + 1) % KB_POOL.length];
    out.push(pick);
    prev = pick;
  }
  return out;
}

// ---- Phân bổ chuyển cảnh cho THÂN video ----
/**
 * n cảnh thân → n−1 mối nối. Tỉ lệ theo nguồn: đa số cut; 1 CỤM counter-slide 2 mối liên tiếp
 * quanh giữa (cùng hướng trong cụm — luật số 2 của Apple); 1 bloom trắng vào cảnh cuối;
 * 1 whip-blur ở ~1/3 khi đủ dài.
 */
export function planBodyJoins(nBody: number, seed: number): Join[] {
  const m = Math.max(0, nBody - 1);
  const joins: Join[] = Array.from({ length: m }, () => ({
    type: 'cut',
    dur: 0,
  }));
  if (m === 0) return joins;
  const rnd = mulberry32(seed ^ 0x9e3779b9);
  const dir: 1 | -1 = rnd() < 0.5 ? 1 : -1;

  if (m === 1) {
    joins[0] = { type: 'counterslide', dur: JOIN_DUR.counterslide, dir };
    return joins;
  }
  // cụm counter-slide 2 mối liên tiếp quanh giữa (m ≥ 4), m = 2-3 thì 1 mối
  const cLen = m >= 4 ? 2 : 1;
  const cStart = Math.max(
    0,
    Math.min(m - cLen - (nBody >= 3 ? 1 : 0), Math.floor(m / 2) - 1),
  );
  for (let i = cStart; i < cStart + cLen; i++)
    joins[i] = { type: 'counterslide', dur: JOIN_DUR.counterslide, dir };
  // bloom trắng: mối nối VÀO cảnh cuối (nguồn đặt bloom ở 48.87/54s)
  if (nBody >= 3 && joins[m - 1].type === 'cut')
    joins[m - 1] = { type: 'fadewhite', dur: JOIN_DUR.fadewhite };
  // whip-blur: ~1/3, chỉ khi video đủ dài và không đè lên mối đã gán
  if (nBody >= 5) {
    const w = Math.max(0, Math.round(m / 3) - 1);
    if (joins[w].type === 'cut')
      joins[w] = { type: 'hblur', dur: JOIN_DUR.hblur };
  }
  return joins;
}

// ---- Thời lượng thân video ----
export type BodyTiming = {
  /** thời lượng từng cảnh sau khi quantize theo nhịp + nới cho đủ chỗ chuyển cảnh */
  durations: number[];
  joins: Join[];
  /** tổng thân video = Σd − Σ overlap */
  bodyTotal: number;
};

/**
 * Quantize thời lượng cảnh theo nhịp rồi NỚI cảnh nào ngắn hơn tổng 2 chuyển cảnh hai bên
 * (cảnh giữa cụm counter-slide gánh 0.95s × 2 — không nới sẽ vỡ filter graph).
 * `edgeOverlap` = phần card mở/kết ăn vào cảnh đầu/cuối (fade 0.5s mỗi đầu, 0 nếu quick mode).
 */
export function bodyTiming(
  rawDurations: number[],
  joins: Join[],
  bpm: number | null,
  edgeOverlap: { head: number; tail: number } = { head: 0, tail: 0 },
): BodyTiming {
  const b = bpm ? beatSec(bpm) : null;
  const durations = rawDurations.map((d) => quantizeToBeat(d, bpm));
  for (let i = 0; i < durations.length; i++) {
    const left = (i === 0 ? edgeOverlap.head : joinOverlap(joins[i - 1])) ?? 0;
    const right =
      (i === durations.length - 1 ? edgeOverlap.tail : joinOverlap(joins[i])) ??
      0;
    const need = left + right + 0.8; // còn ít nhất 0.8s "đứng yên" giữa 2 chuyển cảnh
    while (durations[i] < need)
      durations[i] = b ? Math.round((durations[i] + b) * 1000) / 1000 : need;
  }
  const bodyTotal =
    durations.reduce((a, d) => a + d, 0) -
    joins.reduce((a, j) => a + joinOverlap(j), 0);
  return { durations, joins, bodyTotal: Math.round(bodyTotal * 1000) / 1000 };
}

/**
 * Thời lượng mặc định 1 cảnh ở chế độ nhanh: 1 khuông 4/4 (nguồn: 90BPM → 2.667s).
 * Nhạc nhanh (≥110BPM — hoặc bộ đo bắt nhịp đôi) → 8 nhịp, giữ cảnh ~2.5-3.5s thay vì 1.5s.
 */
export function quickSceneSec(bpm: number | null): number {
  if (!bpm) return 2.667;
  const beats = bpm >= 110 ? 8 : 4;
  return Math.round(beats * beatSec(bpm) * 1000) / 1000;
}

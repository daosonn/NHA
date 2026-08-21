/**
 * Stand-in data for the Home screen.
 *
 * Replace with react-query hooks against the NestJS API once the endpoints
 * exist — see docs/01-frontend/architecture.md. Shapes here are a guess at
 * the contract, not the contract itself.
 */

import type { SpecialDateItem } from '../lib/api';

export type Recommendation = {
  id: string;
  title: string;
  meta?: string;
  tone: 'light' | 'dark';
  /**
   * Banner bundled with the app (`assets/banners/`), not user media.
   * `tone` still matters: it is the stripe colour behind the image while it
   * decodes, and the fallback if the asset is ever missing.
   */
  image?: number;
};

export const recommendations: {
  feature: Recommendation;
  secondary: [Recommendation, Recommendation];
} = {
  feature: {
    id: 'r1',
    title: '家族のテト',
    meta: '写真31枚',
    tone: 'light',
    image: require('../../assets/banners/tet-at-home.jpg') as number,
  },
  secondary: [
    {
      id: 'r2',
      title: '2019年の今日',
      tone: 'dark',
      image: require('../../assets/banners/on-this-day.jpg') as number,
    },
    {
      id: 'r3',
      title: 'お父さんと工房',
      tone: 'light',
      image: require('../../assets/banners/workshop.jpg') as number,
    },
  ],
};

export const notificationCount = 3;

/**
 * Mốc ngày mặc định của màn Home — phần trang trí của app, không phải dữ liệu
 * của một gia đình cụ thể (giống `recommendations` phía trên).
 *
 * Vì sao cần: card sự kiện chỉ vẽ khi API trả về một mốc, nên một tài khoản
 * chưa có gia đình (hoặc gia đình chưa khai ngày nào) thấy màn Home khuyết một
 * khối lớn. Mốc thật của gia đình LUÔN thắng mốc này — nó chỉ đứng thay khi
 * chưa có gì, đúng như các thẻ おすすめ đang làm.
 */
const DEFAULT_MONTH = 8;
const DEFAULT_DAY = 24;
const DEFAULT_ORIGIN_YEAR = 1976;

/** Hàm, không phải hằng: đếm ngược phải đúng vào ngày người ta xem nó. */
export function defaultOccasion(today = new Date()): SpecialDateItem {
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(today.getFullYear(), DEFAULT_MONTH - 1, DEFAULT_DAY);
  if (next < midnight) next = new Date(today.getFullYear() + 1, DEFAULT_MONTH - 1, DEFAULT_DAY);
  const daysUntil = Math.round((next.getTime() - midnight.getTime()) / 86_400_000);

  return {
    source: 'CUSTOM',
    type: 'ANNIVERSARY',
    title: 'おじいちゃんとおばあちゃんの金婚式',
    month: DEFAULT_MONTH,
    day: DEFAULT_DAY,
    originYear: DEFAULT_ORIGIN_YEAR,
    ordinal: next.getFullYear() - DEFAULT_ORIGIN_YEAR,
    theme: 'BUNTING',
    nextOccurrence: `${next.getFullYear()}-${String(DEFAULT_MONTH).padStart(2, '0')}-${String(DEFAULT_DAY).padStart(2, '0')}`,
    daysUntil,
    members: [],
  };
}

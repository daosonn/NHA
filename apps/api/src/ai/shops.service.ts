import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

/**
 * Product resolver — biến Ý TƯỞNG của AI thành SẢN PHẨM CỤ THỂ (0 token).
 *
 * Port đầy đủ từ demo onemoretime (`src/lib/shops/{resolve,yahoo}.ts`, đã chạy thật):
 * LLM chỉ sinh ý tưởng + TỪ KHOÁ TIẾNG NHẬT; tầng này gọi Yahoo!ショッピング với
 * ngân sách THẬT, thử nới dần khi 0 kết quả, chấm điểm, loại sản phẩm vi phạm
 * `avoid` (kiêng kỵ sức khoẻ), rồi giữ 3 món tốt nhất. Cache theo (từ khoá, dải
 * giá, tuần) để không gọi lại API và tôn trọng rate limit ~1 req/s.
 *
 * Nguyên tắc gốc giữ nguyên: AI sinh Ý TƯỞNG, không sinh sản phẩm — tên và giá
 * luôn đến từ API sàn. Không có YAHOO_SHOPPING_APPID → trả rỗng kèm lý do
 * (fail-soft, gift ideas vẫn hoạt động, UI rơi về nút link tìm kiếm).
 */

export interface ShopProduct {
  name: string;
  price: number;
  url: string;
  image: string | null;
  review_rate: number | null;
  review_count: number | null;
  store: string | null;
  /** điểm xếp hạng nội bộ (giá hợp lý + uy tín + khớp từ khoá + có ảnh) */
  score: number;
}

/** Vì sao ra/không ra sản phẩm — UI hiện thành các badge nhỏ (cache / đã nới / đã loại). */
export interface ResolveInfo {
  keyword_ja: string;
  price_min: number;
  price_max: number;
  fetched: number;
  kept: number;
  dropped_by_avoid: number;
  cached: boolean;
  /** nhãn của bước nới nếu phải nới ("nới ngân sách", 'rút gọn từ khoá → "…"') */
  relaxed: string | null;
  attempts: string[];
  error: string | null;
}

export interface ResolveResult {
  products: ShopProduct[];
  info: ResolveInfo;
}

const ENDPOINT =
  'https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch';
const TIMEOUT_MS = 12_000;
const DEFAULT_LIMIT = 3;

/**
 * 体験ギフト (catalog quà trải nghiệm) LÀ sản phẩm thật bán trên sàn Nhật → quà
 * "Together" vẫn ra được link cụ thể, người nhận tự chọn ngày/nơi trong catalog.
 * Bảng này hard-code (không để LLM tự viết) vì đây là cách người Nhật thật sự tìm.
 */
const EXPERIENCE_KEYWORDS: Record<string, string> = {
  dining: '体験ギフト レストラン 食事券',
  onsen_spa: '体験ギフト 温泉 スパ エステ',
  travel_stay: '体験ギフト 宿泊 旅行',
  craft_workshop: '体験ギフト ものづくり 陶芸 体験',
  photo: '体験ギフト 写真撮影 フォトスタジオ',
  general: '体験ギフト カタログ 総合版',
};

export function experienceKeyword(
  kind: string | null | undefined,
): string | null {
  return kind ? (EXPERIENCE_KEYWORDS[kind] ?? null) : null;
}

type YahooHit = {
  name?: string;
  url?: string;
  price?: number;
  image?: { medium?: string; small?: string };
  exImage?: { url?: string };
  review?: { rate?: number; count?: number };
  seller?: { name?: string };
};

/** "3.000〜8.000円" | "〜20.000円+" → [min, max] JPY. Dùng cho ngân sách người dùng chọn. */
export function parseJpyRange(label: string | null | undefined): {
  min: number;
  max: number;
} {
  const nums = label
    ? [...label.matchAll(/[\d.,]+/g)].map((m) =>
        Number(m[0].replace(/[.,]/g, '')),
      )
    : [];
  const valid = nums.filter((n) => Number.isFinite(n) && n > 0);
  if (valid.length >= 2)
    return { min: Math.min(...valid), max: Math.max(...valid) };
  if (valid.length === 1) {
    // "〜8.000円" = trần; "15.000円〜" = sàn
    return /^[〜~]/.test(label!.trim())
      ? { min: 500, max: valid[0] }
      : { min: Math.round(valid[0] * 0.5), max: valid[0] };
  }
  return { min: 1000, max: 20000 };
}

/**
 * Từ khoá cần TRÁNH, suy từ `avoid` của hồ sơ — chặn ngay ở mức tên sản phẩm.
 * Bản đồ tiếng Việt/Anh → token tiếng Nhật (port nguyên từ demo, thêm nhánh EN
 * vì hồ sơ trong NHA có thể viết bằng tiếng Anh).
 */
function buildAvoidTokens(avoidItems: string[]): string[] {
  const map: [RegExp, string[]][] = [
    [
      /ngọt|bánh kẹo|đường|kẹo|chè|sweet|sugar|candy|cake|dessert/i,
      [
        'スイーツ',
        'お菓子',
        'ケーキ',
        'チョコ',
        '砂糖',
        '飴',
        '菓子',
        'ドーナツ',
      ],
    ],
    [
      /rượu|bia|cồn|alcohol|wine|beer|sake/i,
      ['お酒', 'ワイン', 'ビール', '日本酒', '焼酎', 'ウイスキー'],
    ],
    [/mặn|muối|natri|salt|sodium/i, ['塩分', '漬物', '塩辛']],
    [
      /cúi|mang vác|nặng|lưng|khớp|heavy|bend|back|knee|joint/i,
      ['重量', 'ダンベル', '大型', '業務用'],
    ],
    [/cay|spicy/i, ['激辛', '唐辛子']],
    [/thuốc lá|hút thuốc|smok|tobacco/i, ['タバコ', '喫煙']],
    [
      /hoa|phấn hoa|dị ứng|allerg|pollen|flower/i,
      ['生花', '花束', 'アレルギー'],
    ],
  ];
  const out = new Set<string>();
  for (const item of avoidItems) {
    for (const [re, tokens] of map)
      if (re.test(item)) tokens.forEach((t) => out.add(t));
  }
  return [...out];
}

/** Giá hợp lý (0.35) + uy tín review (0.25) + khớp từ khoá (0.2) + có ảnh (0.1) + nền (0.05). */
function scoreProduct(
  p: ShopProduct,
  min: number,
  max: number,
  keyword: string,
): number {
  const mid = (min + max) / 2;
  const half = Math.max(1, (max - min) / 2);
  const priceFit = Math.max(0, 1 - Math.abs(p.price - mid) / (half * 2));

  const avg = p.review_rate ?? 0;
  const cnt = p.review_count ?? 0;
  const trust =
    cnt > 0 ? Math.min(1, (avg / 5) * (Math.log10(cnt + 1) / 2.5)) : 0.15;

  const tokens = keyword.split(/[\s\u3000]+/).filter((t) => t.length >= 2);
  const title = p.name.toLowerCase();
  const match = tokens.length
    ? tokens.filter((t) => title.includes(t.toLowerCase())).length /
      tokens.length
    : 0.5;

  return (
    0.35 * priceFit +
    0.25 * trust +
    0.2 * match +
    0.1 * (p.image ? 1 : 0) +
    0.05
  );
}

/** Tuần ISO thô — cache sản phẩm hết hạn theo tuần (giá sàn đổi chậm hơn thế). */
function weekKey(): string {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7,
  );
  return `${d.getFullYear()}W${week}`;
}

@Injectable()
export class ShopsService {
  private readonly logger = new Logger(ShopsService.name);
  private readonly appId: string;
  private readonly affiliateId: string;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.appId = config.get<string>('YAHOO_SHOPPING_APPID') ?? '';
    this.affiliateId = config.get<string>('VALUECOMMERCE_AFFILIATE_ID') ?? '';
  }

  get enabled(): boolean {
    return this.appId.length > 0;
  }

  /**
   * Phân giải một ý tưởng thành sản phẩm cụ thể.
   * `keyword` là từ khoá tiếng Nhật (LLM sinh) hoặc từ khoá 体験ギフト cho quà trải nghiệm.
   */
  async resolve(opts: {
    keyword: string;
    priceMin: number;
    priceMax: number;
    avoidItems: string[];
    limit?: number;
  }): Promise<ResolveResult> {
    const limit = opts.limit ?? DEFAULT_LIMIT;
    const info: ResolveInfo = {
      keyword_ja: opts.keyword,
      price_min: Math.round(opts.priceMin),
      price_max: Math.round(opts.priceMax),
      fetched: 0,
      kept: 0,
      dropped_by_avoid: 0,
      cached: false,
      relaxed: null,
      attempts: [],
      error: null,
    };

    if (!this.enabled) {
      info.error = 'shops_disabled';
      return { products: [], info };
    }
    if (!opts.keyword.trim()) {
      info.error = 'no_keyword';
      return { products: [], info };
    }

    const cacheKey = `${weekKey()}|${opts.keyword}|${info.price_min}-${info.price_max}`;
    const cached = await this.readCache(cacheKey);
    if (cached) {
      info.cached = true;
      info.fetched = cached.length;
      info.kept = Math.min(cached.length, limit);
      return { products: cached.slice(0, limit), info };
    }

    // Thang thử: nguyên trạng → nới ngân sách → rút gọn từ khoá → nới cả hai.
    // Từ khoá càng cụ thể càng dễ 0 kết quả, nên phải có đường xuống.
    const shorten = (kw: string): string | null => {
      const parts = kw.split(/[\s\u3000]+/).filter(Boolean);
      return parts.length >= 2 ? parts.slice(0, -1).join(' ') : null;
    };
    const short1 = shorten(opts.keyword);
    const short2 = short1 ? shorten(short1) : null;
    const plans = [
      {
        kw: opts.keyword,
        min: opts.priceMin,
        max: opts.priceMax,
        label: 'exact',
      },
      {
        kw: opts.keyword,
        min: opts.priceMin * 0.6,
        max: opts.priceMax * 1.8,
        label: 'wider_budget',
      },
      ...(short1
        ? [
            {
              kw: short1,
              min: opts.priceMin * 0.6,
              max: opts.priceMax * 1.8,
              label: `shorter:${short1}`,
            },
          ]
        : []),
      ...(short2
        ? [
            {
              kw: short2,
              min: opts.priceMin * 0.4,
              max: opts.priceMax * 2.5,
              label: `shorter:${short2}`,
            },
          ]
        : []),
    ];

    const errors: string[] = [];
    let all: ShopProduct[] = [];
    let usedMin = opts.priceMin;
    let usedMax = opts.priceMax;
    let usedKeyword = opts.keyword;

    for (const plan of plans) {
      const items = await this.searchYahoo(plan.kw, plan.min, plan.max).catch(
        (e: unknown) => {
          errors.push(String((e as Error)?.message ?? e).slice(0, 120));
          return [] as ShopProduct[];
        },
      );
      info.attempts.push(`${plan.label}: ${items.length}`);
      if (items.length > 0) {
        all = items;
        usedMin = plan.min;
        usedMax = plan.max;
        usedKeyword = plan.kw;
        if (plan.label !== 'exact') info.relaxed = plan.label;
        break;
      }
    }
    info.keyword_ja = usedKeyword;
    info.fetched = all.length;
    if (errors.length) info.error = errors.join(' · ');

    const avoidTokens = buildAvoidTokens(opts.avoidItems);
    const coreTokens = usedKeyword
      .split(/[\s\u3000]+/)
      .filter((t) => t.length >= 2);
    // Khi đã phải nới/rút gọn, sàn trả nhiều hàng lạc đề → tên PHẢI chứa ít nhất
    // một từ khoá gốc; thà không hiện còn hơn hiện sai.
    const mustMatch = !!info.relaxed && coreTokens.length > 0;
    const seen = new Set<string>();
    const filtered: ShopProduct[] = [];

    for (const p of all) {
      if (p.price < usedMin * 0.9 || p.price > usedMax * 1.1) continue;
      if (mustMatch && !coreTokens.some((t) => p.name.includes(t))) continue;
      if (avoidTokens.some((t) => p.name.includes(t))) {
        info.dropped_by_avoid++;
        continue;
      }
      const dedup = p.name.slice(0, 40);
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      // Lọc theo dải ĐÃ NỚI nhưng chấm điểm theo ngân sách GỐC → món sát túi tiền lên đầu.
      filtered.push({
        ...p,
        score: Number(
          scoreProduct(p, opts.priceMin, opts.priceMax, usedKeyword).toFixed(4),
        ),
      });
    }
    filtered.sort((a, b) => b.score - a.score);
    const top = filtered.slice(0, limit);
    info.kept = top.length;
    if (!top.length && !info.error) info.error = 'no_match';

    if (top.length) await this.writeCache(cacheKey, usedKeyword, top);
    return { products: top, info };
  }

  private async searchYahoo(
    keyword: string,
    priceMin: number,
    priceMax: number,
  ): Promise<ShopProduct[]> {
    const params = new URLSearchParams({
      appid: this.appId,
      query: keyword,
      price_from: String(Math.max(0, Math.round(priceMin))),
      price_to: String(Math.round(priceMax)),
      results: '20',
      sort: '-review_count', // nhiều review = tín hiệu hàng thật đang bán
      in_stock: 'true',
      condition: 'new',
      image_size: '300',
    });
    if (this.affiliateId) {
      params.set('affiliate_type', 'vc');
      params.set('affiliate_id', this.affiliateId);
    }

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const rsp = await fetch(`${ENDPOINT}?${params.toString()}`, {
        headers: { 'User-Agent': 'NHA/1.0 (family gift ideas)' },
        signal: ctl.signal,
      });
      if (!rsp.ok) throw new Error(`Yahoo ${rsp.status}`);
      const json = (await rsp.json()) as { hits?: YahooHit[] };
      return (json.hits ?? [])
        .filter((h) => h.name && h.url && typeof h.price === 'number')
        .map((h) => ({
          name: h.name!,
          price: h.price!,
          url: h.url!,
          image: h.exImage?.url ?? h.image?.medium ?? h.image?.small ?? null,
          review_rate:
            typeof h.review?.rate === 'number' ? h.review.rate : null,
          review_count:
            typeof h.review?.count === 'number' ? h.review.count : null,
          store: h.seller?.name ?? null,
          score: 0,
        }));
    } finally {
      clearTimeout(timer);
    }
  }

  private async readCache(cacheKey: string): Promise<ShopProduct[] | null> {
    try {
      const row = await this.prisma.productCache.findUnique({
        where: { cacheKey },
        select: { products: true },
      });
      return row ? (row.products as unknown as ShopProduct[]) : null;
    } catch (error) {
      this.logger.warn(`product cache read: ${String(error)}`);
      return null;
    }
  }

  private async writeCache(
    cacheKey: string,
    keyword: string,
    products: ShopProduct[],
  ): Promise<void> {
    try {
      await this.prisma.productCache.upsert({
        where: { cacheKey },
        // Cast sang kiểu Json của Prisma — mảng object thuần không tự khớp InputJsonValue
        create: {
          cacheKey,
          keyword,
          products: products as unknown as Prisma.InputJsonValue,
        },
        update: {
          keyword,
          products: products as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(`product cache write: ${String(error)}`);
    }
  }
}

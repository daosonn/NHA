import { Image } from 'react-native';

import news01 from '../../assets/news/news-01.jpg';
import news02 from '../../assets/news/news-02.jpg';
import news03 from '../../assets/news/news-03.jpg';
import news04 from '../../assets/news/news-04.jpg';
import news05 from '../../assets/news/news-05.jpg';
import news06 from '../../assets/news/news-06.jpg';
import news07 from '../../assets/news/news-07.jpg';
import news08 from '../../assets/news/news-08.jpg';

/**
 * Tin tức / quảng cáo Alpha Club hiển thị trong lúc chờ render video
 * (components/video/news-carousel.tsx).
 *
 * Nguồn: section NEWS trên https://www.alphaclub.co.jp/ (bản tách ở
 * C:\NHA\alphaclub-news-slider). Dữ liệu tĩnh tạm thời — khi có endpoint
 * tin tức thì thay bằng react-query hook, giữ nguyên shape `NewsItem`.
 * Ảnh đã thu về ≤600px cạnh dài, JPEG q68 (~300 KB cho cả 8 tin) — card chỉ
 * rộng ~270px trên điện thoại nên ở 2x vẫn nét.
 */

export type NewsItem = {
  id: string;
  /** Hiển thị nguyên văn, ví dụ "2026 08/13" — theo cách viết của trang gốc. */
  date: string;
  title: string;
  url: string;
  /** Module id của ảnh bundle (import tĩnh). */
  image: number;
};

export const newsAllUrl = 'https://www.alphaclub.co.jp/news/';

/**
 * URL thật của một ảnh bundle.
 *
 * Trên web, Metro biến `import ảnh` thành object `{ uri, width, height }` dù
 * TypeScript thấy là `number`; trên native là id số → phải hỏi
 * `Image.resolveAssetSource`.
 */
function assetUri(image: number): string | null {
  const asObject = image as unknown as { uri?: unknown };
  if (typeof asObject === 'object' && asObject !== null && typeof asObject.uri === 'string') {
    return asObject.uri;
  }
  return Image.resolveAssetSource?.(image)?.uri ?? null;
}

/**
 * Nạp trước 8 ảnh vào cache ảnh của nền tảng.
 *
 * Gọi khi người dùng bước vào luồng tạo video (app/video/_layout.tsx) — không
 * nạp từ lúc mở app. Trên web dev, lần đầu vẽ mỗi ảnh phải xin Metro từng file —
 * Sơn thấy khung trống vài giây (26/08). Nạp từ màn setup thì tới màn chờ render
 * (4-5 bước sau) ảnh đã sẵn trong cache trình duyệt / bộ nhớ.
 */
export function prefetchNewsImages(): void {
  for (const item of newsItems) {
    const uri = assetUri(item.image);
    if (uri !== null) {
      Image.prefetch(uri).catch(() => undefined);
    }
  }
}

export const newsItems: NewsItem[] = [
  {
    id: 'n-20260813',
    date: '2026 08/13',
    title: 'メタバース霊園「風の霊」NFT区画の販売を開始しました',
    url: 'https://www.alphaclub.co.jp/news/information/20260813_oshirase/',
    image: news01,
  },
  {
    id: 'n-20260810',
    date: '2026 08/10',
    title: '【令和9年度成人式】この夏がラストチャンス！お得な特典満載の『振袖大展示会』8・9月に埼玉で開催',
    url: 'https://www.alphaclub.co.jp/news/20260810_pressrelease/',
    image: news02,
  },
  {
    id: 'n-20260805',
    date: '2026 08/05',
    title: '春日部市役所が一夜限りの夏祭り会場に！「納涼夏祭り」を開催',
    url: 'https://www.alphaclub.co.jp/news/pressrelease/pressrelease_20260805/',
    image: news03,
  },
  {
    id: 'n-20260801',
    date: '2026 08/01',
    title: '春日部市役所内カフェ　ビアホールで１日限りのDJイベントを開催！『今日だけはあの頃に戻ろう。』',
    url: 'https://www.alphaclub.co.jp/news/pressrelease/pressrelease_20260801/',
    image: news04,
  },
  {
    id: 'n-20260731',
    date: '2026 07/31',
    title: '【入場無料！】『SAITAMA子育て応援フェスタ×Sonic City 2026』を大宮ソニックシティで開催',
    url: 'https://www.alphaclub.co.jp/news/pressrelease/pressrelease_20260731/',
    image: news05,
  },
  {
    id: 'n-20260707',
    date: '2026 07/07',
    title: '宇宙葬『Space voyage α』初の打ち上げが無事成功しました',
    url: 'https://www.alphaclub.co.jp/news/information/20260707_oshirase/',
    image: news06,
  },
  {
    id: 'n-20260706',
    date: '2026 07/06',
    title: '【お知らせ】宇宙葬「Space voyage α」打ち上げ日時決定',
    url: 'https://www.alphaclub.co.jp/news/20260706_oshirase/',
    image: news07,
  },
  {
    id: 'n-20260623',
    date: '2026 06/23',
    title: '「帰省しないお盆」が増える中、テクノロジーで故人を想う新たな供養の形を提案',
    url: 'https://www.alphaclub.co.jp/news/pressrelease/20260623_pressrelease/',
    image: news08,
  },
];

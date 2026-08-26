import { ArrowRight } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { type NewsItem, newsAllUrl, newsItems } from '../../fixtures/news';
import { colors, radius } from '../../theme';
import { Text } from '../ui/text';

/** Card đầu thẳng mép trái; phần lẻ để lộ mép card kế tiếp → gợi ý vuốt. */
const CARD_RATIO = 0.78;
const GAP = 10;
/** Tự trượt sang tin kế tiếp mỗi 2,5 s (đúng bản web đã chốt), tạm dừng khi người dùng đang kéo. */
const AUTOPLAY_MS = 2500;
/** Thời gian animation scrollTo ước lượng — sau đó nhảy về đầu (không animation) cho vòng lặp liền mạch. */
const SETTLE_MS = 450;

export type NewsCarouselProps = {
  items?: NewsItem[];
};

/**
 * Dải tin tức / quảng cáo của Alpha Club, port từ `C:\NHA\alphaclub-news-slider`
 * (Swiper) sang React Native thuần để dùng được cả web và native.
 *
 * Bố cục dọc cho khổ hẹp: NEWS ở trên → card chạy ở giữa → chấm trang trái,
 * "全てのニュース →" phải. Tiêu đề luôn 1 dòng (`numberOfLines={1}`).
 *
 * Vòng lặp: render thêm bản sao của card đầu ở cuối; khi trượt tới bản sao,
 * đợi animation xong rồi nhảy về card 0 không animation — mắt không thấy khớp.
 */
export function NewsCarousel({ items = newsItems }: NewsCarouselProps) {
  const { t } = useTranslation();
  const scroll = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  /** Bản ref của index để interval đọc/ghi không qua updater (tránh side-effect bị gọi 2 lần ở dev). */
  const indexRef = useRef(0);
  const paused = useRef(false);
  const n = items.length;

  const setCurrent = useCallback((i: number) => {
    indexRef.current = i;
    setIndex(i);
  }, []);

  const cardW = Math.round(width * CARD_RATIO);
  const step = cardW + GAP;

  const goTo = useCallback(
    (i: number, animated: boolean) => {
      scroll.current?.scrollTo({ x: i * step, animated });
    },
    [step],
  );

  useEffect(() => {
    if (width === 0 || n < 2) return;
    const id = setInterval(() => {
      if (paused.current) return;
      const next = indexRef.current + 1;
      goTo(next, true);
      if (next === n) {
        // Đang trượt tới bản sao của card 0 → chờ animation xong rồi nhảy về 0 thật.
        setCurrent(0);
        setTimeout(() => {
          if (!paused.current) goTo(0, false);
        }, SETTLE_MS);
      } else {
        setCurrent(next);
      }
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [width, n, goTo, setCurrent]);

  const onDragEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw = Math.round(e.nativeEvent.contentOffset.x / step);
    const i = Math.max(0, Math.min(raw, n));
    if (i === n) {
      goTo(0, false);
      setCurrent(0);
    } else {
      setCurrent(i);
    }
    paused.current = false;
  };

  const open = (url: string) => {
    void Linking.openURL(url);
  };

  return (
    <View style={{ gap: 10 }} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      {/* 1. Tiêu đề */}
      <View style={{ gap: 1 }}>
        <Text serif weight="bold" style={{ fontSize: 22, lineHeight: 26, letterSpacing: 1.2 }}>
          {t('video.newsLabel')}
        </Text>
        <Text variant="caption" color={colors.text.muted}>
          {t('video.newsSub')}
        </Text>
      </View>

      {/* 2. Dải card tự chạy */}
      {width > 0 && (
        <ScrollView
          ref={scroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          snapToAlignment="start"
          decelerationRate="fast"
          onScrollBeginDrag={() => {
            paused.current = true;
          }}
          onMomentumScrollEnd={onDragEnd}
          onScrollEndDrag={onDragEnd}
          contentContainerStyle={{ gap: GAP, paddingRight: width - cardW }}
        >
          {[...items, items[0]].map((item, k) => (
            <Pressable
              key={`${item.id}-${k}`}
              onPress={() => open(item.url)}
              accessibilityRole="link"
              accessibilityLabel={item.title}
              style={{ width: cardW, gap: 6 }}
            >
              <View
                style={{
                  aspectRatio: 16 / 10,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: colors.state.borderDefault,
                  backgroundColor: colors.background.subtle,
                  overflow: 'hidden',
                }}
              >
                {/* Ảnh tĩnh đóng gói sẵn → dùng Image của RN, không dùng expo-image:
                    expo-image web có fade-in `transition` mà với ảnh đã nằm trong
                    cache trình duyệt thì onLoad không tới → ảnh ở opacity 0 mãi
                    (Sơn thấy khung trống + nhãn ngày trên bản demo 26/08). */}
                <Image
                  source={item.image}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
                {/* Nhãn ngày đè góc phải-dưới ảnh — như bản web của alphaclub */}
                <View
                  style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderTopLeftRadius: radius.sm,
                    borderBottomLeftRadius: radius.sm,
                    backgroundColor: 'rgba(24,24,27,0.6)',
                  }}
                >
                  <Text variant="badge" weight="medium" color={colors.text.white} style={{ letterSpacing: 0.6 }}>
                    {item.date}
                  </Text>
                </View>
              </View>

              <Text variant="body2" weight="semibold" numberOfLines={1} style={{ paddingHorizontal: 2 }}>
                {item.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* 3. Chân: chấm trang trái · đọc tất cả phải */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {items.map((item, k) => (
            <View
              key={item.id}
              style={{
                width: k === index ? 16 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: k === index ? colors.coral.brand : colors.state.borderDashed,
              }}
            />
          ))}
        </View>

        <Pressable
          onPress={() => open(newsAllUrl)}
          accessibilityRole="link"
          accessibilityLabel={t('video.newsAll')}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text variant="caption" weight="medium" color={colors.coral.hover}>
            {t('video.newsAll')}
          </Text>
          <ArrowRight size={13} color={colors.coral.hover} strokeWidth={2.2} />
        </Pressable>
      </View>
    </View>
  );
}

import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { MemoDetail } from '../../lib/api';
import { relativeTime } from '../../lib/date';
import { thumbnailSource } from '../../lib/media-source';
import { colors, elevation, radius } from '../../theme';
import { Chip } from '../ui/chip';
import { PhotoPlaceholder } from '../ui/photo-placeholder';
import { Text } from '../ui/text';

/** The five words the app offers. Also the `Chip` themes, one for one. */
export const MEMO_CATEGORIES = ['hobbies', 'health', 'gift', 'memories', 'todo'] as const;

export type MemoCategory = (typeof MEMO_CATEGORIES)[number];

/** What each category is *for*, said in the reader's words. */
const CATEGORY_KEY: Record<MemoCategory, string> = {
  hobbies: 'member.memoCategories.hobbies',
  health: 'member.memoCategories.health',
  gift: 'member.memoCategories.gift',
  memories: 'member.memoCategories.memories',
  todo: 'member.memoCategories.todo',
};

/**
 * `MemoDetail.category` is free text — the server stores whatever the client
 * sends and never validates the taxonomy. So a value from an older build, or
 * from a future one, has to survive being read: anything unrecognised is
 * drawn as a plain neutral chip with its own text rather than dropped.
 */
export function categoryChip(category: string | null): {
  label: string | null;
  theme: MemoCategory | 'neutral';
} {
  if (category === null || category === '') return { label: null, theme: 'neutral' };

  const known = MEMO_CATEGORIES.find((value) => value === category);
  return known === undefined
    ? { label: category, theme: 'neutral' }
    : { label: CATEGORY_KEY[known], theme: known };
}

/** The catalogue key for a category the app knows, for pickers and headings. */
export function categoryKey(category: MemoCategory): string {
  return CATEGORY_KEY[category];
}

/**
 * The category as a finished word, for a sentence rather than a chip.
 *
 * Falls back to the stored value for a category this build does not know, and
 * to a dash when there is none — a meta line reading "· 3 photos" with a hole
 * in front of it looks like a bug.
 */
export function categoryLabel(t: (key: string) => string, category: string | null): string {
  const chip = categoryChip(category);
  if (chip.label === null) return t('member.memoCategories.none');
  return chip.theme === 'neutral' ? chip.label : t(chip.label);
}

export type MemoCardProps = {
  memo: MemoDetail;
  /**
   * Ghi chú này viết về ai — chỉ cần trên hồ sơ của chính bạn, nơi sổ tay gộp
   * ghi chú về nhiều người. Ở hồ sơ một người thì cả trang đã nói về họ rồi.
   */
  aboutLabel?: string | null;
  onPress?: () => void;
  onLongPress?: () => void;
};

/**
 * One note in the grid.
 *
 * The photo leads when there is one: a note about an object is easier to find
 * again by the object than by the sentence describing it. Everything below it
 * keeps the same order whether or not the photo is there, so a column of mixed
 * cards still reads down the category chips.
 */
export function MemoCard({ memo, aboutLabel, onPress, onLongPress }: MemoCardProps) {
  const { t } = useTranslation();

  const cover = memo.media[0];
  const when = relativeTime(memo.updatedAt);
  const chip = categoryChip(memo.category);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={memo.title}
      accessibilityHint={t('member.memoOpenHint')}
      style={[
        {
          borderRadius: radius['2xl'],
          backgroundColor: colors.background.card,
          padding: 14,
          gap: 8,
        },
        elevation.card,
      ]}
    >
      {/* Ảnh thật: `GET /media/:id` cần bearer nên đi qua `thumbnailSource`,
          cùng đường mà dòng thời gian và album dùng. Vệt sọc nằm dưới làm nền
          trong lúc ảnh đang giải mã. */}
      {cover !== undefined && (
        <View style={{ height: 88, borderRadius: radius.md, overflow: 'hidden' }}>
          <PhotoPlaceholder period={12} style={StyleSheet.absoluteFill} />
          <Image
            source={thumbnailSource(cover.id, cover.mimeType)}
            recyclingKey={cover.id}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={140}
          />
        </View>
      )}

      {aboutLabel !== undefined && aboutLabel !== null && aboutLabel !== '' && (
        <Text variant="caption" weight="semibold" color={colors.coral.deep}>
          {aboutLabel}
        </Text>
      )}

      {chip.label !== null && (
        <View style={{ alignSelf: 'flex-start' }}>
          <Chip
            label={chip.theme === 'neutral' ? chip.label : t(chip.label)}
            theme={chip.theme}
            showDot
          />
        </View>
      )}

      <Text variant="body1" weight="semibold" style={{ letterSpacing: -0.1 }}>
        {memo.title}
      </Text>

      {memo.content !== null && memo.content !== '' && (
        <Text variant="body2" color={colors.text.muted} numberOfLines={3}>
          {memo.content}
        </Text>
      )}

      {when !== null && (
        <Text variant="caption" weight="medium" color={colors.text.lightMuted}>
          {t(when.key, { count: when.count })}
        </Text>
      )}
    </Pressable>
  );
}

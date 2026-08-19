import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { MemoItem } from '../../fixtures/member';
import { relativeTime } from '../../lib/date';
import { colors, elevation, radius } from '../../theme';
import { Chip } from '../ui/chip';
import { PhotoPlaceholder } from '../ui/photo-placeholder';
import { Text } from '../ui/text';

/** What each category is *for*, said in the reader's words. */
export const CATEGORY_KEY: Record<MemoItem['category'], string> = {
  hobbies: 'member.memoCategories.hobbies',
  health: 'member.memoCategories.health',
  gift: 'member.memoCategories.gift',
  memories: 'member.memoCategories.memories',
  todo: 'member.memoCategories.todo',
};

export type MemoCardProps = {
  memo: MemoItem;
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
export function MemoCard({ memo, onPress, onLongPress }: MemoCardProps) {
  const { t } = useTranslation();

  const cover = memo.photos[0];
  const when = relativeTime(memo.updatedAt);

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
      {cover !== undefined && (
        <PhotoPlaceholder
          tone={cover.tone}
          period={12}
          style={{ height: 88, borderRadius: radius.md }}
        />
      )}

      <View style={{ alignSelf: 'flex-start' }}>
        <Chip label={t(CATEGORY_KEY[memo.category])} theme={memo.category} showDot />
      </View>

      <Text variant="body1" weight="semibold" style={{ letterSpacing: -0.1 }}>
        {memo.title}
      </Text>

      {memo.body !== null && memo.body !== '' && (
        <Text variant="body2" color={colors.text.muted} numberOfLines={3}>
          {memo.body}
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

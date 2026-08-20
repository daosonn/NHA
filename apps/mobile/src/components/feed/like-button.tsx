import { Heart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { ReactionType } from '../../lib/api';
import { colors, radius } from '../../theme';
import { Text } from '../ui/text';

/**
 * What the app sends when somebody taps the heart.
 *
 * `ReactionType` has five values on the server and the app deliberately uses
 * one. See the component note.
 */
const HEART: ReactionType = 'LOVE';

export type LikeButtonProps = {
  /** The viewer's own reaction, whichever of the five it happens to be. */
  mine: ReactionType | null;
  count: number;
  /** `null` clears it — tapping a lit heart takes it back. */
  onChange: (type: ReactionType | null) => void;
};

/**
 * One heart, and how many there are.
 *
 * This used to be five icons — thumb, heart, laugh, star, frown — one per
 * `ReactionType`. It was replaced on 2026-08-20 because the server does not
 * return a breakdown: `PostDetail` carries `reactionCount`, a single total,
 * and `myReaction`, which is only ever *your* own. So five buttons fed one
 * undifferentiated number: tap the star and the total goes up by one, exactly
 * as it would have for a heart, and nobody could ever see that a star had
 * been left. Five ways to do the same invisible thing is not a choice, it is
 * a puzzle.
 *
 * A reaction somebody set earlier — through an older build, or another
 * client — still lights the heart, because the honest reading of "you have
 * reacted" is the one the count agrees with. Tapping clears it.
 *
 * If the server ever returns a per-type breakdown the five come back, and
 * this file is where they go.
 */
export function LikeButton({ mine, count, onChange }: LikeButtonProps) {
  const { t } = useTranslation();

  const active = mine !== null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Pressable
        onPress={() => onChange(active ? null : HEART)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={active ? t('post.reactions.clear') : t('post.reactions.love')}
        hitSlop={6}
        style={{
          height: 36,
          paddingHorizontal: 12,
          borderRadius: radius.full,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          backgroundColor: active ? colors.coral.light : colors.background.card,
          boxShadow: active
            ? `inset 0 0 0 1.5px ${colors.coral.border}`
            : `inset 0 0 0 1px ${colors.state.borderDefault}`,
        }}
      >
        <Heart
          size={17}
          color={active ? colors.coral.brand : colors.text.subtle}
          strokeWidth={2}
          fill={active ? colors.coral.brand : 'transparent'}
        />

        <Text
          variant="caption"
          weight="semibold"
          color={active ? colors.coral.deep : colors.text.secondary}
        >
          {/* The number, not the word: the count is the whole point, and at
              zero there is nothing to count so the verb does the work. */}
          {count > 0 ? String(count) : t('post.reactions.love')}
        </Text>
      </Pressable>
    </View>
  );
}

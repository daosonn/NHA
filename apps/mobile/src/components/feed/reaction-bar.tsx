import { Frown, Heart, Laugh, Star, ThumbsUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { ReactionType } from '../../lib/api';
import { colors, radius } from '../../theme';
import { Text } from '../ui/text';

type Entry = {
  type: ReactionType;
  Icon: typeof Heart;
  /** Catalogue key — screen readers get a word, not a shape. */
  label: string;
};

/**
 * The five the server stores (`ReactionType`), drawn rather than written as
 * emoji: the design system allows Lucide and nothing else, and an emoji would
 * render differently on every phone in the family.
 */
const ENTRIES: Entry[] = [
  { type: 'LIKE', Icon: ThumbsUp, label: 'post.reactions.like' },
  { type: 'LOVE', Icon: Heart, label: 'post.reactions.love' },
  { type: 'HAHA', Icon: Laugh, label: 'post.reactions.haha' },
  { type: 'WOW', Icon: Star, label: 'post.reactions.wow' },
  { type: 'SAD', Icon: Frown, label: 'post.reactions.sad' },
];

export type ReactionBarProps = {
  mine: ReactionType | null;
  count: number;
  /** `null` clears the reaction — tapping the active one takes it back. */
  onChange: (type: ReactionType | null) => void;
};

/**
 * One reaction per person, so these behave like radio buttons rather than
 * toggles: picking LOVE after LIKE replaces it. Tapping the active one again
 * removes it, which is the only way back to none.
 */
export function ReactionBar({ mine, count, onChange }: ReactionBarProps) {
  const { t } = useTranslation();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {ENTRIES.map(({ type, Icon, label }) => {
        const active = mine === type;

        return (
          <Pressable
            key={type}
            onPress={() => onChange(active ? null : type)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(label)}
            hitSlop={6}
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? colors.coral.subtle : 'transparent',
            }}
          >
            <Icon
              size={19}
              color={active ? colors.coral.primary : colors.text.subtle}
              strokeWidth={2}
            />
          </Pressable>
        );
      })}

      {count > 0 && (
        <Text variant="caption" weight="medium" color={colors.text.body}>
          {count}
        </Text>
      )}
    </View>
  );
}

import { ChevronUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { colors } from '../../theme';
import { Text } from '../ui/text';

/**
 * Hint that the moments feed is one swipe away.
 *
 * It is a hint and not a button: the feed is rendered directly below on
 * Home, so scrolling past this cue *is* the gesture it describes.
 */
export type SwipeCueProps = {
  /** Optional shortcut. Omit it on Home, where scrolling already works. */
  onPress?: () => void;
};

export function SwipeCue({ onPress }: SwipeCueProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      disabled={onPress === undefined}
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      style={{ alignItems: 'center', gap: 2 }}
    >
      <ChevronUp size={18} color="rgba(24,24,27,0.22)" strokeWidth={2} />
      <Text
        variant="caption"
        weight="medium"
        color={colors.text.lightMuted}
        style={{ letterSpacing: 0.2 }}
      >
        {t('home.swipeCue')}
      </Text>
    </Pressable>
  );
}

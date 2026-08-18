import { ChevronUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { colors, radius, spacing } from '../../theme';
import { Avatar } from '../ui/avatar';
import { PhotoPlaceholder } from '../ui/photo-placeholder';
import { Text } from '../ui/text';

/** Hint that the moments feed is one swipe away. */
export type SwipeCueProps = {
  /** Opens the moments list. Without it the cue stays decorative. */
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

/**
 * The top sliver of the first moment card, softened so it reads as "there is
 * more below" rather than as content.
 *
 * TODO: replace with the real feed once the moments list exists — this is
 * scenery, not data.
 */
export function MomentPeek() {
  return (
    <View
      style={[
        {
          position: 'absolute',
          left: spacing.xl,
          right: spacing.xl,
          bottom: 0,
          height: 150,
          borderTopLeftRadius: radius['3xl'],
          borderTopRightRadius: radius['3xl'],
          backgroundColor: colors.background.card,
          padding: 14,
          gap: 10,
          opacity: 0.55,
          overflow: 'hidden',
        },
        { boxShadow: '0 -8px 24px rgba(24,24,27,0.06)', filter: 'blur(1.2px)' },
      ]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar size={36} />
        <View style={{ gap: 3 }}>
          <View
            style={{ width: 64, height: 9, borderRadius: radius.full, backgroundColor: '#E4E4E7' }}
          />
          <View
            style={{ width: 100, height: 8, borderRadius: radius.full, backgroundColor: '#EFEFF1' }}
          />
        </View>
      </View>
      <PhotoPlaceholder style={{ height: 80, borderRadius: radius.lg }} />
    </View>
  );
}

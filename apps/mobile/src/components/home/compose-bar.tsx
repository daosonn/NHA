import { PenLine, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors, elevation, radius } from '../../theme';
import { AnimatedPressable } from '../motion/animated-pressable';
import { usePressScale } from '../motion/press';
import { Text } from '../ui/text';

/**
 * The way into "New moment", pinned at the top of Home (owner's call,
 * 2026-08-26 — see § Bottom navigation in `design-system.md`): the bar's
 * centre used to be a + that posted, and Home's top row was the family
 * strip — two + buttons on one screen meaning different things. The centre
 * is the family tree now, and posting starts here, where the feed it posts
 * into begins.
 *
 * A prompt, not a form: tapping anywhere opens the composer screen. The
 * coral disc on the right is the same 36px language as the strip's cap was,
 * so the row reads as "this is where you act".
 */
export function ComposeBar({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();

  const press = usePressScale();

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('nav.newMoment')}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        {
          height: 52,
          borderRadius: radius.full,
          backgroundColor: colors.background.card,
          paddingLeft: 16,
          paddingRight: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        elevation.card,
        press.style,
      ]}
    >
      <PenLine size={17} color={colors.text.lightMuted} strokeWidth={2.1} />

      <Text variant="body2" weight="medium" color={colors.text.muted} style={{ flex: 1 }}>
        {t('home.composePrompt')}
      </Text>

      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.full,
          backgroundColor: colors.coral.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={19} color={colors.text.white} strokeWidth={2.3} />
      </View>
    </AnimatedPressable>
  );
}

import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { Occasion } from '../../fixtures/ai';
import { colors, radius } from '../../theme';
import { IconBadge } from '../ui/icon-badge';
import { Text } from '../ui/text';
import { DateTile } from './date-tile';
import { occasionIcon, occasionLabelKey } from './occasion-kind';

export type OccasionRowProps = {
  occasion: Occasion;
  onPress?: () => void;
};

/** One date on the calendar: when, what, and what kind of day it is. */
export function OccasionRow({ occasion, onPress }: OccasionRowProps) {
  const { t } = useTranslation();

  const away = t('ai.daysAway', { count: occasion.daysAway });
  const meta = occasion.note !== null ? `${away} · ${occasion.note}` : away;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('ai.occasionLabel', { title: occasion.title, meta })}
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: colors.background.card,
        borderRadius: radius['2xl'],
        borderWidth: 1,
        borderColor: colors.state.borderDefault,
        paddingVertical: 11,
        paddingHorizontal: 13,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <DateTile day={occasion.day} month={occasion.month} />

      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text variant="body2" weight="semibold" style={{ letterSpacing: -0.1 }}>
          {occasion.title}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text variant="badge" color={colors.text.muted}>
            {meta}
          </Text>

          <Text
            variant="badge"
            weight="semibold"
            color={colors.text.lightMuted}
            style={{
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              paddingHorizontal: 7,
              paddingVertical: 4,
              borderRadius: radius.sm,
              backgroundColor: colors.background.subtle,
            }}
          >
            {t(occasionLabelKey(occasion.kind))}
          </Text>
        </View>
      </View>

      <IconBadge
        size={28}
        background={colors.background.subtle}
        foreground={colors.text.muted}
        renderIcon={occasionIcon(occasion.kind)}
      />
    </Pressable>
  );
}

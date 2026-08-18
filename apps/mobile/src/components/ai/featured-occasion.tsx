import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { FeaturedOccasion } from '../../fixtures/ai';
import { colors, radius } from '../../theme';
import { Button } from '../ui/button';
import { IconBadge } from '../ui/icon-badge';
import { Text } from '../ui/text';
import { DateTile } from './date-tile';
import { occasionIcon } from './occasion-kind';

export type FeaturedOccasionProps = {
  occasion: FeaturedOccasion;
  onPlan?: () => void;
  onGifts?: () => void;
  onVideo?: () => void;
};

/**
 * The next date that needs a decision.
 *
 * It says what has been arranged so far — "nothing planned" is the whole
 * reason the card is at the top. A countdown alone would only be a
 * reminder; the point is that it is still possible to act.
 */
export function FeaturedOccasion({ occasion, onPlan, onGifts, onVideo }: FeaturedOccasionProps) {
  const { t } = useTranslation();

  const meta = [t('ai.daysAway', { count: occasion.daysAway }), occasion.note, occasion.status]
    .filter((part) => part !== null)
    .join(' · ');

  return (
    <View
      style={{
        backgroundColor: colors.coral.light,
        borderRadius: radius['4xl'],
        padding: 15,
        gap: 13,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <DateTile day={occasion.day} month={occasion.month} tone="card" />

        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text variant="subtitle" weight="semibold" style={{ letterSpacing: -0.15 }}>
            {occasion.title}
          </Text>

          <Text variant="caption" color={colors.text.muted}>
            {meta}
          </Text>
        </View>

        <IconBadge
          size={36}
          background={colors.coral.primary}
          foreground={colors.text.white}
          renderIcon={occasionIcon(occasion.kind)}
        />
      </View>

      {/* Only what leads somewhere. A button that does nothing costs more
          trust than the missing feature does. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {onPlan !== undefined && (
          <Button label={t('ai.planSurprise')} size="small" onPress={onPlan} />
        )}
        {onGifts !== undefined && (
          <Button label={t('ai.giftIdeas')} variant="neutral" size="small" onPress={onGifts} />
        )}
        {onVideo !== undefined && (
          <Button label={t('ai.video')} variant="neutral" size="small" onPress={onVideo} />
        )}
      </View>
    </View>
  );
}

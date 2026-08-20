import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { useOccasionLabel } from '../../features/ai/use-special-dates';
import type { SpecialDateItem } from '../../lib/api';
import { formatFullDate } from '../../lib/date';
import { colors, radius, spacing } from '../../theme';
import { PhotoPlaceholder } from '../ui/photo-placeholder';
import { Text } from '../ui/text';

const HEIGHT = 196;

/**
 * How far off it is.
 *
 * Local because this widget is the only thing that says it in a headline
 * voice. Today and tomorrow get their own words rather than "in 0 days" and
 * "in 1 day" — nobody says either, in any of the languages here.
 */
function countdownLabel(daysUntil: number): { key: string; values: Record<string, number> } {
  if (daysUntil <= 0) return { key: 'home.occasion.today', values: {} };
  if (daysUntil === 1) return { key: 'home.occasion.tomorrow', values: {} };
  return { key: 'home.occasion.inDays', values: { count: daysUntil } };
}
const FLAG_W = 20;
const FLAG_H = 24;

/**
 * Bunting for the anniversary theme. The widget's decoration changes with the
 * event type (birthday = confetti + candles, memorial = floral border), so
 * this stays local rather than becoming a shared component.
 */
const BUNTING = [
  colors.coral.brand,
  colors.themes.memories.accent,
  colors.coral.brand,
  colors.themes.hobbies.accent,
  colors.themes.memories.accent,
  colors.coral.brand,
  colors.themes.hobbies.accent,
  colors.themes.memories.accent,
];

function Bunting() {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 26,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
      }}
      pointerEvents="none"
    >
      {BUNTING.map((fill, i) => (
        <Svg key={i} width={FLAG_W} height={FLAG_H}>
          <Polygon points={`0,0 ${FLAG_W},0 ${FLAG_W / 2},${FLAG_H}`} fill={fill} />
        </Svg>
      ))}
    </View>
  );
}

function DetailRow({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: radius.full,
          backgroundColor: colors.coral.brand,
        }}
      />
      <Text variant="caption" color={colors.text.secondary} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

export type EventWidgetProps = {
  occasion: SpecialDateItem;
  /** How many more are coming up behind this one. */
  moreCount?: number;
};

/**
 * The next occasion the family has coming up.
 *
 * Three things the mockup drew are gone, because `SpecialDateItem` has no
 * field behind any of them and a birthday is not an event you RSVP to:
 *
 * - **a place.** Occasions are dates, not gatherings; there is nowhere to be.
 * - **a "Join" button.** There is nothing to join — see above.
 * - **paging dots.** They were decoration pretending to be a control. The
 *   count of what is behind this one is said in words instead.
 *
 * The decoration stays bunting whatever `theme` says. `CONFETTI_CANDLES` and
 * `FLORAL_BORDER` have no drawing yet, and a plain white box for a memorial
 * would read as a widget that failed to load.
 */
export function EventWidget({ occasion, moreCount = 0 }: EventWidgetProps) {
  const { t } = useTranslation();

  // One place words an occasion, and `main` already owns it — the AI hub and
  // the occasion pickers read the same sentences. A second wording here would
  // have drifted from theirs the first time either was touched.
  const occasionLabel = useOccasionLabel();

  const countdown = countdownLabel(occasion.daysUntil);
  const when = formatFullDate(occasion.nextOccurrence);

  return (
    <View
      style={[
        {
          height: HEIGHT,
          borderRadius: radius['4xl'],
          borderWidth: 3,
          borderColor: colors.background.card,
          overflow: 'hidden',
        },
        { boxShadow: '0 10px 28px rgba(24,24,27,0.1), 0 0 0 1px rgba(24,24,27,0.07)' },
      ]}
    >
      <PhotoPlaceholder style={StyleSheet.absoluteFill} />
      <Bunting />

      <View
        style={[
          {
            position: 'absolute',
            top: 36,
            right: spacing.md,
            width: 150,
            borderRadius: radius.md,
            backgroundColor: 'rgba(255,255,255,0.92)',
            padding: 10,
            gap: 6,
          },
          { boxShadow: '0 6px 16px rgba(24,24,27,0.12)' },
        ]}
      >
        <Text
          variant="caption"
          weight="bold"
          color={colors.coral.deep}
          style={{ letterSpacing: 0.2 }}
        >
          {t(countdown.key, countdown.values).toLocaleUpperCase()}
        </Text>
        <Text variant="body2" weight="semibold">
          {occasionLabel(occasion)}
        </Text>
        {when !== null && <DetailRow>{when}</DetailRow>}
        {moreCount > 0 && <DetailRow>{t('home.occasion.more', { count: moreCount })}</DetailRow>}
      </View>
    </View>
  );
}

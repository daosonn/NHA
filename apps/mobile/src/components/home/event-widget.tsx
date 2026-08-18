import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { colors, radius, spacing } from '../../theme';
import type { UpcomingEvent } from '../../fixtures/home';
import { Button } from '../ui/button';
import { PhotoPlaceholder } from '../ui/photo-placeholder';
import { Text } from '../ui/text';

const HEIGHT = 196;
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
  event: UpcomingEvent;
  onJoin?: () => void;
};

/** The next thing the family has to show up for. */
export function EventWidget({ event, onJoin }: EventWidgetProps) {
  const { t } = useTranslation();

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
          {event.countdown}
        </Text>
        <Text variant="body2" weight="semibold">
          {event.title}
        </Text>
        <DetailRow>{event.when}</DetailRow>
        <DetailRow>{event.where}</DetailRow>
      </View>

      <View style={{ position: 'absolute', left: 14, bottom: 14 }}>
        <Button label={t('home.join')} size="small" onPress={onJoin} />
      </View>

      <View
        style={{
          position: 'absolute',
          right: 14,
          bottom: 16,
          flexDirection: 'row',
          gap: 5,
        }}
      >
        {Array.from({ length: event.total }, (_, i) => (
          <View
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: radius.full,
              backgroundColor: i === event.index ? colors.text.white : 'rgba(255,255,255,0.5)',
            }}
          />
        ))}
      </View>
    </View>
  );
}

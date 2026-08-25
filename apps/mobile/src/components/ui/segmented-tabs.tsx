import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors, elevation, radius } from '../../theme';
import { useSlidingThumb } from '../motion/sliding-thumb';
import { Text } from './text';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Shown beside the label when the section has content. */
  count?: number;
};

export type SegmentedTabsProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Announced before the tab name, e.g. "Timeline tab, Mai's profile". */
  accessibilityLabel?: string;
};

/**
 * Switches between sections of one screen — not navigation between screens.
 *
 * The active segment is a white pill, deliberately **not** coral: the accent
 * is reserved for the primary button, the active bottom-nav tab, the "You"
 * node, badges and the active timeline node. Adding a sixth use would dilute
 * all five.
 *
 * The pill is ONE thumb that slides between segments (segmented-pill demo,
 * via `useSlidingThumb`) rather than a background each segment paints when
 * active — the journey is what tells you the selection moved.
 *
 * Segments are `flex-1`, so three or four options share the width evenly on
 * any handset instead of being sized to their text.
 */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedTabsProps<T>) {
  const thumb = useSlidingThumb(value);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        gap: 4,
        padding: 4,
        borderRadius: radius.full,
        backgroundColor: colors.background.subtle,
      }}
    >
      {/* Behind the segments; pointerEvents off so it never eats a tap. */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 4,
            height: 44,
            borderRadius: radius.full,
            backgroundColor: colors.background.card,
          },
          elevation.card,
          thumb.style,
        ]}
      />

      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            onLayout={thumb.itemLayout(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.full,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <Text
              variant="body2"
              weight={active ? 'semibold' : 'medium'}
              color={active ? colors.text.primary : colors.text.muted}
            >
              {option.label}
            </Text>

            {option.count !== undefined && option.count > 0 && (
              <Text
                variant="badge"
                weight="semibold"
                color={active ? colors.text.subtle : colors.text.lightMuted}
              >
                {option.count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

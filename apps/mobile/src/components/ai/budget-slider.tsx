import { useRef, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';

import { colors, radius } from '../../theme';
import { Text } from '../ui/text';

export const BUDGET_MAX = 20000;
const STEP = 500;
const MARKS = [0, 5000, 10000, 15000, 20000];

/** "3.000" — the mockup writes thousands with dots (11a). */
export function formatJpy(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "3.000〜8.000円", open-ended at the top: "15.000円〜". */
export function budgetLabel(lo: number, hi: number): string {
  if (hi >= BUDGET_MAX) return lo === 0 ? `〜${formatJpy(BUDGET_MAX)}円+` : `${formatJpy(lo)}円〜`;
  return `${formatJpy(lo)}〜${formatJpy(hi)}円`;
}

export type BudgetSliderProps = {
  value: [number, number];
  onChange: (value: [number, number]) => void;
};

/**
 * The two-handle budget slider of screen 11a. One responder on the whole
 * track: touching anywhere grabs the nearest handle, so tap and drag both
 * work, on web and native, without a gesture library.
 */
export function BudgetSlider({ value, onChange }: BudgetSliderProps) {
  const [width, setWidth] = useState(0);
  const [lo, hi] = value;
  // Which handle the current gesture owns — chosen on grant, kept while moving,
  // so dragging one handle across the other cannot swap them mid-gesture.
  const active = useRef<'lo' | 'hi' | null>(null);

  const toX = (v: number) => (width * v) / BUDGET_MAX;
  const fromEvent = (e: GestureResponderEvent) => {
    const x = Math.max(0, Math.min(width, e.nativeEvent.locationX));
    const raw = (x / Math.max(1, width)) * BUDGET_MAX;
    return Math.round(raw / STEP) * STEP;
  };

  const move = (v: number) => {
    if (active.current === 'lo') onChange([Math.min(v, hi), hi]);
    else if (active.current === 'hi') onChange([lo, Math.max(v, lo)]);
  };

  return (
    <View style={{ gap: 6 }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          const v = fromEvent(e);
          active.current = Math.abs(v - lo) <= Math.abs(v - hi) ? 'lo' : 'hi';
          move(v);
        }}
        onResponderMove={(e) => move(fromEvent(e))}
        onResponderRelease={() => {
          active.current = null;
        }}
        // Tall hit area; the visible track is the thin line in the middle.
        style={{ height: 40, justifyContent: 'center' }}
      >
        <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.background.subtle }} />
        {width > 0 && (
          <>
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: toX(lo),
                width: Math.max(0, toX(hi) - toX(lo)),
                height: 5,
                borderRadius: 3,
                backgroundColor: colors.coral.primary,
              }}
            />
            {([lo, hi] as const).map((v, i) => (
              <View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: toX(v) - 11,
                  width: 22,
                  height: 22,
                  borderRadius: radius.full,
                  backgroundColor: colors.background.card,
                  borderWidth: 1,
                  borderColor: colors.state.borderNeutral,
                  boxShadow: '0 1px 4px rgba(24,24,27,0.16)',
                }}
              />
            ))}
          </>
        )}
      </View>

      {/* the scale: 0 · 5.000 · 10.000 · 15.000 · 20.000円+ */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {MARKS.map((m, i) => (
          <Text key={m} variant="badge" color={colors.text.subtle}>
            {i === MARKS.length - 1 ? `${formatJpy(m)}円+` : formatJpy(m)}
          </Text>
        ))}
      </View>
    </View>
  );
}

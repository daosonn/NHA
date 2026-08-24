import { Check, TriangleAlert } from 'lucide-react-native';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, radius, spacing } from '../../theme';
import { exit, toastIn } from '../../theme/motion';
import { Text } from './text';

/** Long enough to read a short sentence, short enough not to be in the way. */
const VISIBLE_MS = 3200;

type Tone = 'success' | 'failure';

type Toast = { id: number; tone: Tone; message: string };

type ToastValue = {
  /** Both take a **finished string** — the caller has `t`, this does not. */
  success: (message: string) => void;
  failure: (message: string) => void;
};

const ToastContext = createContext<ToastValue | null>(null);

/**
 * Confirmation that something happened.
 *
 * The app had no way to say "saved" — a memo, an album, a resent invitation
 * all completed in silence, and the only difference between "it worked" and
 * "nothing happened when I pressed that" was whether the list underneath
 * changed. For anything that does not visibly change the screen, that is no
 * difference at all.
 *
 * One at a time, bottom of the screen, above the safe area. Not a queue: if a
 * second thing happens the second thing is what matters, and stacking
 * confirmations is how a corner of the screen becomes unreadable.
 *
 * Failures get the same treatment as successes rather than a dialog. A toast
 * is right for "that did not save, try again"; anything the person must act
 * on belongs in the screen, next to the thing that needs acting on.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const show = useCallback((tone: Tone, message: string) => {
    if (timer.current !== null) clearTimeout(timer.current);

    nextId.current += 1;
    setToast({ id: nextId.current, tone, message });

    timer.current = setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

  const value = useMemo<ToastValue>(
    () => ({
      success: (message) => show('success', message),
      failure: (message) => show('failure', message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {toast !== null && (
        <Animated.View
          // Keyed on the id so a replacement re-enters rather than swapping
          // its text in place, which reads as a glitch.
          key={toast.id}
          entering={toastIn}
          exiting={exit.down}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: spacing.xl,
            right: spacing.xl,
            bottom: insets.bottom + 90,
          }}
        >
          <View
            accessibilityRole="alert"
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: radius['3xl'],
                backgroundColor:
                  toast.tone === 'success' ? colors.text.primary : colors.themes.destructive.solid,
              },
              elevation.floating,
            ]}
          >
            {toast.tone === 'success' ? (
              <Check size={17} color={colors.text.white} strokeWidth={2.6} />
            ) : (
              <TriangleAlert size={17} color={colors.text.white} strokeWidth={2.4} />
            )}

            <Text variant="caption" weight="medium" color={colors.text.white} style={{ flex: 1 }}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext);

  if (value === null) {
    throw new Error('useToast must be used inside a ToastProvider');
  }

  return value;
}

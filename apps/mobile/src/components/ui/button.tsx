import { ActivityIndicator, View, type PressableProps } from 'react-native';

import { colors, fonts, radius } from '../../theme';
import { AnimatedPressable } from '../motion/animated-pressable';
import { usePressScale } from '../motion/press';
import { Text } from './text';

export type ButtonVariant =
  'primary' | 'secondary' | 'neutral' | 'ghost' | 'destructive' | 'destructiveSolid';
export type ButtonSize = 'large' | 'medium' | 'small';

type VariantStyle = {
  bg: string;
  bgPressed: string;
  fg: string;
  border?: string;
  /** Ring colour for the loading spinner. */
  spinner: string;
};

/** Disabled is always the neutral grey — never a faded coral. */
const DISABLED = {
  bg: colors.state.disabledBg,
  fg: colors.state.disabledText,
  border: colors.state.disabledBorder,
};

const VARIANTS: Record<ButtonVariant, VariantStyle> = {
  primary: {
    bg: colors.coral.primary,
    bgPressed: colors.coral.dark,
    fg: colors.text.white,
    spinner: colors.text.white,
  },
  secondary: {
    bg: colors.background.card,
    bgPressed: colors.coral.light,
    fg: colors.coral.deep,
    border: colors.coral.border,
    spinner: colors.coral.brand,
  },
  /** No brand opinion: identity providers, secondary actions beside a primary. */
  neutral: {
    bg: colors.background.card,
    bgPressed: colors.background.subtle,
    fg: colors.text.primary,
    border: colors.state.borderNeutral,
    spinner: colors.coral.brand,
  },
  ghost: {
    bg: 'transparent',
    bgPressed: colors.state.pressOverlay,
    fg: colors.text.secondary,
    spinner: colors.coral.brand,
  },
  destructive: {
    bg: colors.background.card,
    bgPressed: colors.themes.destructive.bg,
    fg: colors.themes.destructive.text,
    border: colors.themes.destructive.border,
    spinner: colors.themes.destructive.text,
  },
  destructiveSolid: {
    bg: colors.themes.destructive.solid,
    bgPressed: colors.themes.destructive.press,
    fg: colors.text.white,
    spinner: colors.text.white,
  },
};

const SIZES: Record<ButtonSize, { height: number; px: number; fontSize: number; icon: number }> = {
  large: { height: 52, px: 26, fontSize: 16, icon: 20 },
  medium: { height: 44, px: 22, fontSize: 15, icon: 20 },
  small: { height: 32, px: 14, fontSize: 13, icon: 16 },
};

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  /**
   * Where a hugging button sits in its parent. Ignored when `fullWidth`.
   *
   * It has to be said here because the button sets its own `alignSelf`, and
   * `alignSelf` beats the parent's `alignItems` every time: without this, a
   * button dropped into a centred column silently jumped to the left edge —
   * which is exactly what the empty states were doing.
   */
  align?: 'start' | 'center';
  /** Rendered left of the label. Receives the size-appropriate dimensions. */
  renderIcon?: (props: { size: number; color: string }) => React.ReactNode;
};

/**
 * Flat by design — no shadow, no gradient. Radius is always `full`.
 *
 * Loading keeps the label and swaps the leading slot for a spinner, so the
 * button never changes width mid-press.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'medium',
  loading = false,
  fullWidth = false,
  align = 'start',
  renderIcon,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const isDisabled = disabled === true || loading;
  const isBlocked = disabled === true;

  const fg = isBlocked ? DISABLED.fg : v.fg;
  const borderColor = isBlocked ? (v.border ? DISABLED.border : undefined) : v.border;

  // The press animates scale and fill together (`.nha-press`). The hook owns
  // backgroundColor, so the static style below must not set it — except when
  // blocked, where no press can happen and the grey is static by definition.
  const press = usePressScale(
    isBlocked ? undefined : { background: { rest: v.bg, pressed: v.bgPressed } },
  );

  return (
    <AnimatedPressable
      {...rest}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPressIn={(event) => {
        press.onPressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press.onPressOut();
        onPressOut?.(event);
      }}
      style={[
        {
          height: s.height,
          paddingHorizontal: s.px,
          borderRadius: radius.full,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          alignSelf: fullWidth ? 'stretch' : align === 'center' ? 'center' : 'flex-start',
        },
        isBlocked && { backgroundColor: DISABLED.bg },
        borderColor !== undefined && { borderWidth: 1.5, borderColor },
        press.style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.spinner} style={{ width: 16, height: 16 }} />
      ) : renderIcon ? (
        <View>{renderIcon({ size: s.icon, color: fg })}</View>
      ) : null}
      <Text
        weight="semibold"
        color={fg}
        style={{ fontSize: s.fontSize, lineHeight: s.fontSize * 1.2 }}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

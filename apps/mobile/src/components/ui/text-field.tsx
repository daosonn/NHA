import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, radius, typography } from '../../theme';
import { duration, easing } from '../../theme/motion';
import { useTypeface } from '../../theme/typeface';
import { Text } from './text';

/** Coral ring drawn while the field has focus, matching the mockups. */
const FOCUS_RING = `0 0 0 4px rgba(240,112,95,0.1)`;

/** How far up and how small the floating label travels (the demos' values). */
const LABEL_RISE = -10;
const LABEL_RISE_MULTILINE = -14;
const LABEL_SHRINK = 0.28;

/** The multiline counter turns warning-coloured with this many left. */
const COUNT_WARN_AT = 20;

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Sits under the field in muted text. Replaced by `error` when there is one. */
  hint?: string;
  /** Turns the field red and is shown in place of the hint. */
  error?: string;
  /** Shows a `4/24` counter and enforces the limit. */
  maxLength?: number;
  /** Masks the value and adds a reveal toggle. */
  secure?: boolean;
  /** Rendered left of the input. Follows the focus colour. */
  renderIcon?: (props: { size: number; color: string }) => React.ReactNode;
  /** The tiny uppercase section style of the AI mockups (ANYTHING TO ADD, EDIT…). */
  uppercaseLabel?: boolean;
};

/**
 * A labelled text input.
 *
 * Fields carry a **floating label**
 * (`docs/01-frontend/motion/floating-label-input.html` and
 * `…-textarea.html`): the label rests inside the box and rises on focus or
 * content — 200ms on the bounce curve, colour walking muted → coral as it
 * goes. Multiline boxes rise a little further (-14 vs -10) and count
 * **remaining** characters in the bottom corner, warning-coloured near the
 * limit. Only the uppercase section style keeps its static label above.
 *
 * `TextInput` cannot use the `Text` primitive, so the font family is applied
 * by hand here — React Native has no synthetic bolding, and the default face
 * would silently differ from every other piece of text on the screen.
 */
export function TextField({
  label,
  value,
  onChangeText,
  hint,
  error,
  maxLength,
  secure = false,
  renderIcon,
  multiline = false,
  uppercaseLabel = false,
  placeholder,
  ...rest
}: TextFieldProps) {
  const { t } = useTranslation();
  // `TextInput` cannot use the `Text` primitive, so it asks for the face
  // itself — otherwise it would silently be the one control on the screen
  // still drawing in the Latin font.
  const typeface = useTypeface('medium');

  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const invalid = error !== undefined;
  const borderColor = invalid
    ? colors.themes.destructive.border
    : focused
      ? colors.coral.border
      : colors.state.borderDefault;

  /** The floating variant: every field that is not an uppercase section. */
  const floating = !uppercaseLabel;
  const floated = focused || value.length > 0;

  const float = useSharedValue(floated ? 1 : 0);
  useEffect(() => {
    float.value = withTiming(floated ? 1 : 0, {
      duration: duration.select,
      easing: easing.bounce,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- driven by `floated`.
  }, [floated]);

  const labelRise = multiline ? LABEL_RISE_MULTILINE : LABEL_RISE;
  const floatingLabelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: labelRise * float.value }, { scale: 1 - LABEL_SHRINK * float.value }],
    color: interpolateColor(
      float.value,
      [0, 1],
      [colors.text.muted, invalid ? colors.themes.destructive.text : colors.coral.deep],
    ),
  }));

  return (
    <View style={{ gap: 6 }}>
      {uppercaseLabel ? (
        <Text
          variant="badge"
          weight="semibold"
          color={colors.text.lightMuted}
          style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}
        >
          {label}
        </Text>
      ) : null}

      <View
        style={[
          {
            minHeight: multiline ? 104 : floating ? 56 : 48,
            borderRadius: radius.lg,
            backgroundColor: colors.background.card,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: multiline ? 'flex-start' : 'center',
            gap: 10,
            borderWidth: focused || invalid ? 1.5 : 1,
            borderColor,
          },
          focused && !invalid && { boxShadow: FOCUS_RING },
        ]}
      >
        {floating && (
          <Animated.Text
            numberOfLines={1}
            style={[
              {
                position: 'absolute',
                left: 14 + (renderIcon !== undefined ? 29 : 0),
                top: multiline ? 22 : 18,
                ...typeface,
                fontSize: 14,
                lineHeight: 20,
                transformOrigin: 'left top',
              },
              floatingLabelStyle,
            ]}
          >
            {label}
          </Animated.Text>
        )}
        {renderIcon !== undefined &&
          renderIcon({
            size: 19,
            color: focused ? colors.coral.brand : colors.text.lightMuted,
          })}

        <TextInput
          {...rest}
          // The visible label is a sibling Text, not programmatically attached —
          // without this a screen reader announces only the placeholder.
          accessibilityLabel={rest.accessibilityLabel ?? label}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline={multiline}
          maxLength={maxLength}
          secureTextEntry={secure && !revealed}
          // While the label rests inside the box a placeholder would sit
          // underneath it, two texts in one spot — it waits for the float.
          placeholder={floating && !floated ? undefined : placeholder}
          placeholderTextColor={colors.text.subtle}
          style={{
            flex: 1,
            padding: 0,
            ...typeface,
            fontSize: multiline ? typography.fontSize.body1.fontSize : 14,
            lineHeight: multiline ? typography.fontSize.body1.lineHeight : 20,
            color: colors.text.primary,
            textAlignVertical: multiline ? 'top' : 'center',
            // Room above the text for the floated label to sit inside the box.
            paddingTop: floating ? (multiline ? 26 : 15) : 0,
            paddingBottom: multiline ? 12 : 0,
            // Web: the browser's own black focus rectangle on the inner
            // <input> — the container already draws the coral focus ring.
            // `solid` matters: the UA ring is `outline-style: auto`, which
            // IGNORES outline-width, so width 0 alone changes nothing.
            outlineStyle: 'solid',
            outlineWidth: 0,
          }}
        />

        {/* Single-line only: the floating redesign moved the multiline count
            to the bottom corner below (counting down, warning near the cap). */}
        {maxLength !== undefined && !multiline && (
          <Text variant="badge" color={colors.text.subtle}>
            {`${value.length}/${maxLength}`}
          </Text>
        )}

        {/* The textarea demo counts DOWN, tucked in the bottom corner, and
            turns warning-coloured near the limit — a paragraph writer needs
            "how much is left", not "how much have I written". */}
        {maxLength !== undefined && multiline && (
          <Text
            variant="badge"
            weight="medium"
            color={
              maxLength - value.length <= COUNT_WARN_AT ? colors.coral.hover : colors.text.subtle
            }
            style={{ position: 'absolute', right: 14, bottom: 10 }}
          >
            {`${maxLength - value.length}`}
          </Text>
        )}

        {secure && (
          <Pressable
            onPress={() => setRevealed((shown) => !shown)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('common.hidePassword') : t('common.showPassword')}
            hitSlop={12}
          >
            {revealed ? (
              <EyeOff size={19} color={colors.text.lightMuted} strokeWidth={2} />
            ) : (
              <Eye size={19} color={colors.text.lightMuted} strokeWidth={2} />
            )}
          </Pressable>
        )}
      </View>

      {/* Caption size, not badge: this line is the recovery path after a
          validation error — 10px is unreadable for the readers this app is for. */}
      {(error ?? hint) !== undefined && (
        <Text
          variant="caption"
          color={invalid ? colors.themes.destructive.text : colors.text.subtle}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
}

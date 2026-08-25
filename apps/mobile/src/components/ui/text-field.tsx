import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, typography } from '../../theme';
import { useTypeface } from '../../theme/typeface';
import { Text } from './text';

/** Coral ring drawn while the field has focus, matching the mockups. */
const FOCUS_RING = `0 0 0 4px rgba(240,112,95,0.1)`;

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
      ) : (
        <Text variant="caption" weight="semibold" color={colors.text.secondary}>
          {label}
        </Text>
      )}

      <View
        style={[
          {
            minHeight: multiline ? 88 : 48,
            borderRadius: radius.lg,
            backgroundColor: colors.background.card,
            paddingHorizontal: 14,
            paddingVertical: multiline ? 12 : 0,
            flexDirection: 'row',
            alignItems: multiline ? 'flex-start' : 'center',
            gap: 10,
            borderWidth: focused || invalid ? 1.5 : 1,
            borderColor,
          },
          focused && !invalid && { boxShadow: FOCUS_RING },
        ]}
      >
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
          placeholderTextColor={colors.text.subtle}
          style={{
            flex: 1,
            padding: 0,
            ...typeface,
            fontSize: multiline ? typography.fontSize.body1.fontSize : 14,
            lineHeight: multiline ? typography.fontSize.body1.lineHeight : 20,
            color: colors.text.primary,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />

        {maxLength !== undefined && (
          <Text
            variant="caption"
            color={colors.text.subtle}
            style={{ marginTop: multiline ? 4 : 0 }}
          >
            {`${value.length}/${maxLength}`}
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

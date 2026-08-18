import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { colors, fonts, radius } from '../../theme';
import { Text } from './text';

const BOX_HEIGHT = 62;

export type OtpInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel: string;
  length?: number;
};

/**
 * The boxes are a drawing; the input is one real field stretched over them.
 *
 * Six separate inputs would each need focus juggling and would break paste,
 * autofill and the SMS/e-mail suggestion strip — all of which matter more
 * than the illusion of six fields.
 */
export function OtpInput({ value, onChangeText, accessibilityLabel, length = 6 }: OtpInputProps) {
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  const digits = Array.from({ length }, (_, index) => value[index] ?? '');
  const cursor = Math.min(value.length, length - 1);

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 9 }}>
        {digits.map((digit, index) => {
          const active = focused && index === cursor;

          return (
            <View
              key={index}
              style={{
                flex: 1,
                height: BOX_HEIGHT,
                borderRadius: radius.lg,
                backgroundColor: colors.background.card,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: active ? 1.6 : 1,
                borderColor: active ? colors.coral.border : colors.state.borderDefault,
              }}
            >
              {digit === '' ? (
                active && (
                  <View
                    style={{
                      width: 1.8,
                      height: 24,
                      borderRadius: 1,
                      backgroundColor: colors.coral.primary,
                    }}
                  />
                )
              ) : (
                <Text weight="semibold" style={{ fontSize: 23, lineHeight: 28 }}>
                  {digit}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <TextInput
        ref={input}
        value={value}
        onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={accessibilityLabel}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        caretHidden
        style={[StyleSheet.absoluteFill, { opacity: 0 }]}
      />
    </View>
  );
}

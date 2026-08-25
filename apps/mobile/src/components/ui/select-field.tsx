import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { colors, radius } from '../../theme';
import { SheetModal } from './sheet-modal';
import { Text } from './text';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  /** Shown under the label in the option list. */
  hint?: string;
};

export type SelectFieldProps<T extends string> = {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** Heading of the option sheet. Defaults to the field label. */
  title?: string;
};

/**
 * A labelled picker. Opens a sheet of options rather than a native picker so
 * each option can carry a line of explanation — the relationship list needs
 * it, because a kinship word maps onto a base relationship edge.
 */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  title,
}: SelectFieldProps<T>) {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" weight="semibold" color={colors.text.secondary}>
        {label}
      </Text>

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('common.selectedOption', {
          label,
          value: selected?.label ?? t('common.none'),
        })}
        style={{
          height: 48,
          borderRadius: radius.lg,
          backgroundColor: colors.background.card,
          borderWidth: 1,
          borderColor: colors.state.borderDefault,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="body1" weight="medium">
          {selected?.label ?? ''}
        </Text>
        <ChevronDown size={18} color={colors.text.muted} strokeWidth={2} />
      </Pressable>

      <SheetModal
        visible={open}
        onClose={() => setOpen(false)}
        scrimLabel={t('common.close')}
        style={{ maxHeight: '70%' }}
      >
        <View
          style={{
            flexShrink: 1,
            borderTopLeftRadius: radius['7xl'],
            borderTopRightRadius: radius['7xl'],
            backgroundColor: colors.background.page,
            paddingTop: 10,
            paddingBottom: 34,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 44,
              height: 5,
              borderRadius: radius.full,
              backgroundColor: '#E2DCD7',
            }}
          />

          <Text variant="subtitle" weight="bold" style={{ padding: 20, letterSpacing: -0.2 }}>
            {title ?? label}
          </Text>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {options.map((option) => {
              const active = option.value === value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    minHeight: 52,
                    borderRadius: radius.lg,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: active ? colors.coral.soft : colors.background.card,
                    borderWidth: 1,
                    borderColor: active ? colors.coral.border : colors.state.borderDefault,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="body1" weight={active ? 'semibold' : 'medium'}>
                      {option.label}
                    </Text>
                    {option.hint !== undefined && (
                      <Text variant="badge" color={colors.text.subtle}>
                        {option.hint}
                      </Text>
                    )}
                  </View>

                  {active && <Check size={18} color={colors.coral.deep} strokeWidth={2.4} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </SheetModal>
    </View>
  );
}

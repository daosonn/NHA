import { Check, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import { colors, radius } from '../../theme';
import { Text } from '../ui/text';
import { useTypeface } from '../../theme/typeface';

export type AddPillProps = {
  /** Giá trị user đã tự đặt; rỗng = chưa có, chỉ hiện dấu +. */
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Chip tự đặt đang được chọn (tô đậm như các pill khác). */
  selected?: boolean;
  onSelect?: () => void;
};

/**
 * Dấu "+" cuối một dãy pill: bấm là mở ô nhập ngay tại chỗ để user tự thêm
 * một lựa chọn của mình (dịp riêng, loại video riêng). Khi đã có giá trị, nó
 * trở thành một pill bình thường kèm nút ✕ để bỏ.
 */
export function AddPill({
  value,
  onChange,
  placeholder,
  selected = false,
  onSelect,
}: AddPillProps) {
  const { t } = useTranslation();
  const typeface = useTypeface('semibold');
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  const commit = () => {
    const next = text.trim();
    onChange(next);
    setEditing(false);
    if (next.length > 0) onSelect?.();
  };

  if (editing) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 34,
          paddingLeft: 12,
          paddingRight: 4,
          borderRadius: radius.full,
          backgroundColor: colors.background.card,
          borderWidth: 1.5,
          borderColor: colors.coral.border,
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={commit}
          placeholder={placeholder}
          placeholderTextColor={colors.text.subtle}
          maxLength={24}
          autoFocus
          returnKeyType="done"
          style={{
            minWidth: 110,
            padding: 0,
            ...typeface,
            fontSize: 13,
            color: colors.text.primary,
          }}
        />
        <Pressable
          onPress={commit}
          accessibilityRole="button"
          accessibilityLabel={t('common.done')}
          style={{
            width: 26,
            height: 26,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.coral.primary,
          }}
        >
          <Check size={13} color={colors.text.white} strokeWidth={3} />
        </Pressable>
      </View>
    );
  }

  if (value.length > 0) {
    // Nút ✕ là ANH EM của phần nhãn, không nằm trong nó: Pressable lồng
    // Pressable render thành <button> trong <button> trên web — React gào lỗi
    // và nuốt luôn press, chip kẹt cứng không bỏ cũng không chọn lại được
    // (đúng bài học button-in-button của album).
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 34,
          borderRadius: radius.full,
          // Chọn = coral, giống mọi lựa chọn đã chốt khác trong app (không dùng đen)
          backgroundColor: selected ? colors.coral.primary : colors.background.card,
          borderWidth: selected ? 0 : 1,
          borderColor: colors.state.borderNeutral,
        }}
      >
        <Pressable
          onPress={onSelect}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          style={{ height: '100%', justifyContent: 'center', paddingLeft: 14, paddingRight: 7 }}
        >
          <Text
            variant="caption"
            weight="semibold"
            color={selected ? colors.text.white : colors.text.primary}
          >
            {value}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            onChange('');
            setText('');
          }}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={6}
          style={{ height: '100%', justifyContent: 'center', paddingRight: 8 }}
        >
          <X size={13} color={selected ? colors.text.white : colors.text.muted} strokeWidth={2.4} />
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setEditing(true)}
      accessibilityRole="button"
      accessibilityLabel={placeholder}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        height: 34,
        paddingHorizontal: 13,
        borderRadius: radius.full,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.state.borderDashed,
        backgroundColor: pressed ? colors.background.subtle : 'transparent',
      })}
    >
      <Plus size={14} color={colors.text.secondary} strokeWidth={2.4} />
      <Text variant="caption" weight="semibold" color={colors.text.secondary}>
        {t('common.addOwn')}
      </Text>
    </Pressable>
  );
}

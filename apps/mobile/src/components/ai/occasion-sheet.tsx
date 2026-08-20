import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useOccasionLabel } from '../../features/ai/use-special-dates';
import type { SpecialDateItem } from '../../lib/api';
import { formatDayMonth } from '../../lib/date';
import { colors, radius } from '../../theme';
import { Text } from '../ui/text';
import { TextField } from '../ui/text-field';
import { DateTile } from './date-tile';
import { Sheet } from './sheet';

export type OccasionChoice = { label: string; date: string | null };

export type OccasionSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The family's upcoming dates; rows for the chosen member float to the top. */
  items: SpecialDateItem[];
  memberId: string | null;
  onSelect: (choice: OccasionChoice) => void;
};

/**
 * The picker behind the OCCASION row (11a, 11e): real special dates first
 * — "Birthday 30 Aug · in 16 days" — plus a free-text line for anything
 * the calendar does not know about.
 */
export function OccasionSheet({ visible, onClose, items, memberId, onSelect }: OccasionSheetProps) {
  const { t } = useTranslation();
  const occasionLabel = useOccasionLabel();
  const [custom, setCustom] = useState('');

  const sorted = [...items].sort((a, b) => {
    const aMine = memberId !== null && a.members.some((m) => m.memberId === memberId) ? 0 : 1;
    const bMine = memberId !== null && b.members.some((m) => m.memberId === memberId) ? 0 : 1;
    return aMine - bMine || a.daysUntil - b.daysUntil;
  });

  const pick = (choice: OccasionChoice) => {
    onSelect(choice);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('ai.occasionSheet.title')}>
      {sorted.map((item) => {
        const label = occasionLabel(item);
        const dayMonth = formatDayMonth(item.nextOccurrence);
        return (
          <Pressable
            key={`${item.type}-${item.nextOccurrence}-${item.members[0]?.memberId ?? ''}`}
            onPress={() => pick({ label: `${label}${dayMonth ? ` · ${dayMonth}` : ''}`, date: item.nextOccurrence })}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 11,
              padding: 8,
              borderRadius: radius['2xl'],
              backgroundColor: pressed ? colors.background.subtle : 'transparent',
            })}
          >
            <DateTile day={item.day} month={t(`date.months.${item.month}`)} />
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <Text variant="body2" weight="semibold" numberOfLines={1}>
                {label}
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                {t('ai.daysAway', { count: item.daysUntil })}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {/* Dịp lịch không biết — gia đình tự thêm. Dấu "+" nói rõ đây là thêm mới. */}
      <View style={{ height: 1, backgroundColor: colors.state.borderDefault, marginTop: 6 }} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 6 }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('ai.occasionSheet.somethingElse')}
            uppercaseLabel
            value={custom}
            onChangeText={setCustom}
            placeholder={t('ai.occasionSheet.placeholder')}
            onSubmitEditing={() => custom.trim().length > 0 && pick({ label: custom.trim(), date: null })}
            returnKeyType="done"
          />
        </View>
        <Pressable
          onPress={() => custom.trim().length > 0 && pick({ label: custom.trim(), date: null })}
          accessibilityRole="button"
          accessibilityLabel={t('ai.occasionSheet.addOccasion')}
          disabled={custom.trim().length === 0}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              custom.trim().length === 0 ? colors.state.disabledBg : pressed ? colors.coral.dark : colors.coral.primary,
          })}
        >
          <Plus
            size={20}
            color={custom.trim().length === 0 ? colors.state.disabledText : colors.text.white}
            strokeWidth={2.6}
          />
        </Pressable>
      </View>
    </Sheet>
  );
}

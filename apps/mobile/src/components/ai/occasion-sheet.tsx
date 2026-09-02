import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { tileDayMonthProps } from '../../features/dates/date-meta';
import { useOccasionLabel } from '../../features/ai/use-special-dates';
import type { SpecialDateItem } from '../../lib/api';
import { formatDayMonth } from '../../lib/date';
import { colors, radius } from '../../theme';
import { Button } from '../ui/button';
import { Text } from '../ui/text';
import { TextField } from '../ui/text-field';
import { DateTile } from './date-tile';
import { Sheet } from './sheet';

export type OccasionChoice = { label: string; date: string | null };

export type OccasionSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The family's upcoming dates; filtered down to the chosen member's own
   *  occasions plus any family-wide one (no member tagged) — a birthday
   *  picked for Xuân must never show her sister's. */
  items: SpecialDateItem[];
  memberId: string | null;
  onSelect: (choice: OccasionChoice) => void;
  /** Query state of the caller's dates fetch — free text below stays usable either way. */
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

/**
 * The picker behind the OCCASION row (11a, 11e): real special dates first
 * — "Birthday 30 Aug · in 16 days" — plus a free-text line for anything
 * the calendar does not know about.
 */
export function OccasionSheet({
  visible,
  onClose,
  items,
  memberId,
  onSelect,
  loading = false,
  error = false,
  onRetry,
}: OccasionSheetProps) {
  const { t } = useTranslation();
  const occasionLabel = useOccasionLabel();
  const [custom, setCustom] = useState('');

  // Only this member's own occasions, plus any family-wide one (no member
  // tagged at all) — never someone else's birthday/memorial/anniversary.
  // No member chosen yet (sheet opened before "For" is filled) → show everyone.
  const relevant =
    memberId === null
      ? items
      : items.filter(
          (item) => item.members.length === 0 || item.members.some((m) => m.memberId === memberId),
        );
  const sorted = [...relevant].sort((a, b) => a.daysUntil - b.daysUntil);

  const pick = (choice: OccasionChoice) => {
    onSelect(choice);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('ai.occasionSheet.title')}>
      {loading ? (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator color={colors.coral.primary} />
        </View>
      ) : error ? (
        <View style={{ paddingVertical: 8, gap: 10 }}>
          <Text variant="body2" color={colors.text.body}>
            {t('ai.occasionSheet.loadFailed')}
          </Text>
          <Button label={t('common.retry')} variant="secondary" size="small" onPress={onRetry} />
        </View>
      ) : sorted.length === 0 ? (
        // Không có ngày lưu sẵn — nói rõ để ô nhập bên dưới thành lối đi chính.
        <Text variant="caption" color={colors.text.muted} style={{ paddingVertical: 8 }}>
          {t('ai.occasionSheet.empty')}
        </Text>
      ) : (
        sorted.map((item) => {
          const label = occasionLabel(item);
          const dayMonth = formatDayMonth(item.nextOccurrence);
          return (
            <Pressable
              key={`${item.type}-${item.nextOccurrence}-${item.members[0]?.memberId ?? ''}`}
              onPress={() =>
                pick({
                  label: `${label}${dayMonth ? ` · ${dayMonth}` : ''}`,
                  date: item.nextOccurrence,
                })
              }
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
              <DateTile {...tileDayMonthProps(item, t)} />
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
        })
      )}

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
            onSubmitEditing={() =>
              custom.trim().length > 0 && pick({ label: custom.trim(), date: null })
            }
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
              custom.trim().length === 0
                ? colors.state.disabledBg
                : pressed
                  ? colors.coral.dark
                  : colors.coral.primary,
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

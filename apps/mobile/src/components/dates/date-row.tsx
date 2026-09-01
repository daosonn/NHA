import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import type { MyDateItem } from '../../features/dates/use-my-dates';
import { dateRowMeta, tileDayMonth } from '../../features/dates/date-meta';
import { useOccasionLabel } from '../../features/ai/use-special-dates';
import { colors } from '../../theme';
import { DateTile } from '../ai/date-tile';
import { specialDateIcon, specialDateKindKey } from '../ai/occasion-kind';
import { IconBadge } from '../ui/icon-badge';
import { Text } from '../ui/text';

export type DateRowProps = {
  item: MyDateItem;
  onPress: () => void;
  /** 12a dùng chevron (đi tới chi tiết); 12b dùng icon loại trong vòng tròn. */
  trailing: 'chevron' | 'kind';
  /** Nửa sau của caption — 12a nói LOẠI, 12b nói NHỊP (every year / once). */
  meta: 'kind' | 'repeat';
  /** Hàng không phải đầu tiên trong Card vẽ hairline trên — đúng anatomy hub. */
  divider?: boolean;
};

/**
 * Một hàng "ngày" — cùng anatomy với hàng "Also this season" của AI hub
 * (DateTile + nhãn useOccasionLabel + caption), không phát minh look thứ tư.
 * Ô ngày luôn vẽ ngày DƯƠNG của lần tới (tileDayMonth) — dòng âm lịch mà vẽ
 * item.month/day là sai một tháng trời.
 */
export function DateRow({ item, onPress, trailing, meta, divider = false }: DateRowProps) {
  const { t } = useTranslation();
  const occasionLabel = useOccasionLabel();
  const tile = tileDayMonth(item);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        padding: 6,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: colors.state.borderDefault,
        backgroundColor: pressed ? colors.background.surfaceSoft : 'transparent',
      })}
    >
      <DateTile day={tile.day} month={t(`date.months.${tile.month}`)} />
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text variant="body2" weight="semibold" numberOfLines={1}>
          {occasionLabel(item)}
        </Text>
        <Text variant="caption" color={colors.text.muted} numberOfLines={1}>
          {t('ai.daysAway', { count: item.daysUntil })} ·{' '}
          {dateRowMeta(item, t, meta, t(specialDateKindKey(item.type)))}
        </Text>
      </View>
      {trailing === 'kind' ? (
        <IconBadge
          size={32}
          background={colors.background.subtle}
          foreground={colors.text.muted}
          renderIcon={specialDateIcon(item.type)}
        />
      ) : (
        <ChevronRight size={17} color={colors.text.subtle} strokeWidth={2} />
      )}
    </Pressable>
  );
}

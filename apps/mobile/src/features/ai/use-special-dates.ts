import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { specialDates } from '../../lib/api';
import type { SpecialDateItem } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/** Hub "Coming up" + occasion pickers — ngày sắp tới của family, gần nhất trước. */
export function useSpecialDates(familyId: string | null) {
  return useQuery({
    queryKey: queryKeys.specialDates(familyId ?? 'none'),
    queryFn: () => specialDates.upcoming(familyId as string),
    enabled: familyId !== null,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Nhãn hiển thị của một dịp — DERIVED không mang text (i18n sống ở app):
 * BIRTHDAY + ordinal → "Grandma turns 70", MEMORIAL → "Grandpa's memorial"…
 */
export function useOccasionLabel() {
  const { t } = useTranslation();

  return (item: SpecialDateItem): string => {
    if (item.title) return item.title;
    const name = item.members[0]?.displayName ?? '';
    switch (item.type) {
      case 'BIRTHDAY':
        return item.ordinal !== null
          ? t('ai.hub.birthdayTurns', { name, age: item.ordinal })
          : t('ai.hub.birthdayOf', { name });
      case 'ANNIVERSARY':
        return item.ordinal !== null
          ? t('ai.hub.anniversaryYears', { name, years: item.ordinal })
          : t('ai.hub.anniversaryOf', { name });
      case 'MEMORIAL':
        return t('ai.hub.memorialOf', { name });
      default:
        return t('ai.hub.customDate', { name });
    }
  };
}

import { useRouter } from 'expo-router';
import { CalendarHeart, TriangleAlert } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Pill } from '../../src/components/ai/pill';
import { DateRow } from '../../src/components/dates/date-row';
import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Text } from '../../src/components/ui/text';
import { dateDetailParams } from '../../src/features/dates/date-meta';
import { useMyDates, type MyDateItem } from '../../src/features/dates/use-my-dates';
import { useFamilies } from '../../src/features/family/use-families';
import { colors, spacing } from '../../src/theme';
import { enter } from '../../src/theme/motion';

/** "This season" của mockup 12b — một mùa ~3 tháng. */
const SEASON_DAYS = 92;

type Filter = 'all' | 'me' | { familyId: string };

/**
 * Màn 12b — mọi ngày cả nhà giữ, lọc theo nhà / "Only me", nhóm This
 * season / Later. Dữ liệu là feed tổng hợp /me/special-dates (xuyên mọi
 * nhà — tab Omoide cố tình không còn khái niệm "nhà đang chọn").
 */
export default function DatesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dates = useMyDates();
  const families = useFamilies();
  const [filter, setFilter] = useState<Filter>('all');

  const items = useMemo(() => {
    const all = dates.data ?? [];
    const kept =
      filter === 'all'
        ? all
        : filter === 'me'
          ? all.filter((i) => i.scope === 'PERSONAL')
          : all.filter((i) => i.familyId === filter.familyId);
    // server đã sort gần-nhất-trước; sort lại phòng thủ vì section split tin vào nó
    return [...kept].sort((a, b) => a.daysUntil - b.daysUntil);
  }, [dates.data, filter]);

  const thisSeason = items.filter((i) => i.daysUntil <= SEASON_DAYS);
  const later = items.filter((i) => i.daysUntil > SEASON_DAYS);

  const open = (item: MyDateItem) =>
    router.push({ pathname: '/dates/[id]', params: dateDetailParams(item) });

  const addDate = () =>
    router.push({
      pathname: '/dates/new',
      params:
        filter === 'me'
          ? { scope: 'me' }
          : filter !== 'all'
            ? { familyId: filter.familyId }
            : {},
    });

  const section = (title: string, rows: MyDateItem[], offset: number) =>
    rows.length === 0 ? null : (
      <Animated.View entering={enter.up(offset)} style={{ gap: 9 }}>
        <Text
          variant="caption"
          weight="semibold"
          color={colors.text.secondary}
          style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}
        >
          {title}
        </Text>
        <Card padding={8}>
          {rows.map((item, index) => (
            <DateRow
              key={item.id ?? `${item.type}-${item.familyId}-${item.members[0]?.memberId ?? index}`}
              item={item}
              trailing="kind"
              meta="repeat"
              divider={index > 0}
              onPress={() => open(item)}
            />
          ))}
        </Card>
      </Animated.View>
    );

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton fallback="/omoide" />}
        center={<ScreenTitle title={t('dates.title')} />}
      />

      <ScrollView
        contentContainerStyle={{
          ...contentColumn,
          paddingTop: spacing.xl,
          paddingBottom: 120, // chừa chỗ cho nút ghim dưới
          gap: 15,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* chips lọc — All / từng nhà / Only me (mockup 12b) */}
        <Animated.View entering={enter.up(0)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: 'row', gap: 7 }}
          >
            <Pill
              label={t('dates.filterAll')}
              selected={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            {(families.data ?? []).map((family) => (
              <Pill
                key={family.id}
                label={family.name}
                selected={typeof filter === 'object' && filter.familyId === family.id}
                onPress={() => setFilter({ familyId: family.id })}
              />
            ))}
            <Pill
              label={t('dates.filterMine')}
              selected={filter === 'me'}
              onPress={() => setFilter('me')}
            />
          </ScrollView>
        </Animated.View>

        {dates.isPending ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.coral.primary} />
          </View>
        ) : dates.isError ? (
          <EmptyState
            renderIcon={(props) => <TriangleAlert {...props} strokeWidth={2} />}
            title={t('dates.loadFailed')}
            actionLabel={t('home.retry')}
            onActionPress={() => void dates.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            renderIcon={(props) => <CalendarHeart {...props} strokeWidth={2} />}
            title={t('dates.emptyTitle')}
            description={t('dates.emptyBody')}
          />
        ) : (
          <>
            {section(t('dates.thisSeason'), thisSeason, 1)}
            {section(t('dates.later'), later, 2)}
          </>
        )}
      </ScrollView>

      {/* nút ghim đáy — mockup 12b */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: spacing.xl,
          paddingTop: 12,
          paddingBottom: 24,
          backgroundColor: colors.background.page,
          borderTopWidth: 1,
          borderTopColor: colors.state.borderDefault,
        }}
      >
        <Button
          label={t('dates.addDate')}
          variant="primary"
          size="large"
          fullWidth
          onPress={addDate}
        />
      </View>
    </View>
  );
}

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Bell,
  CalendarHeart,
  Clapperboard,
  Gift,
  Mail,
  PenLine,
  TriangleAlert,
  Users,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';

import { DateTile } from '../../src/components/ai/date-tile';
import { SelectRow } from '../../src/components/ai/select-row';
import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Card } from '../../src/components/ui/card';
import { EmptyState } from '../../src/components/ui/empty-state';
import { IconBadge } from '../../src/components/ui/icon-badge';
import { Text } from '../../src/components/ui/text';
import { useOccasionLabel } from '../../src/features/ai/use-special-dates';
import {
  occasionParam,
  tileDayMonth,
  weekdayIndex,
} from '../../src/features/dates/date-meta';
import { useMyDates, type MyDateItem } from '../../src/features/dates/use-my-dates';
import { useMemberGallery } from '../../src/features/member/use-member-gallery';
import { families as familiesApi } from '../../src/lib/api';
import { formatDayMonth } from '../../src/lib/date';
import { thumbnailSource } from '../../src/lib/media-source';
import { queryKeys } from '../../src/lib/query-keys';
import { colors, radius, spacing } from '../../src/theme';
import { enter } from '../../src/theme/motion';

/** Dải kỷ niệm: đủ để gợi, không phải cả kho — cả kho nằm ở album của người đó. */
const MEMORY_CAP = 12;

/**
 * Màn 12d — chi tiết một ngày: đếm ngược, ai giữ + ai được nhắc, dải ảnh kỷ
 * niệm của người trong ngày, và "Make something for the day" nối sang ba
 * luồng AI với người + dịp đã chọn sẵn.
 *
 * Địa chỉ: id = uuid (dòng CUSTOM) hoặc chữ 'derived' + params
 * familyId/memberId/type — dòng DERIVED không có id vì không có gì được lưu.
 */
export default function DateDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    familyId?: string;
    scope?: string;
    memberId?: string;
    type?: string;
    next?: string;
  }>();
  const occasionLabel = useOccasionLabel();
  const dates = useMyDates();

  const item: MyDateItem | undefined =
    params.id !== 'derived'
      ? (dates.data ?? []).find((i) => i.id === params.id)
      : (dates.data ?? []).find(
          (i) =>
            i.id === null &&
            i.familyId === (params.familyId || null) &&
            i.type === params.type &&
            i.members.some((m) => m.memberId === params.memberId),
        );

  const member = item?.members[0];
  const gallery = useMemberGallery({
    own: false,
    familyId: item?.familyId ?? null,
    memberId: member?.memberId ?? null,
  });
  const familyDetail = useQuery({
    queryKey: queryKeys.family(item?.familyId ?? 'none'),
    queryFn: () => familiesApi.detail(item!.familyId!),
    enabled: (item?.familyId ?? null) !== null,
  });

  if (dates.isPending) {
    return (
      <View className="flex-1 bg-page">
        <AppHeader left={<BackButton fallback="/dates" />} />
        <View style={{ paddingVertical: 60, alignItems: 'center' }}>
          <ActivityIndicator color={colors.coral.primary} />
        </View>
      </View>
    );
  }

  if (item === undefined) {
    return (
      <View className="flex-1 bg-page">
        <AppHeader left={<BackButton fallback="/dates" />} />
        <EmptyState
          renderIcon={(props) =>
            dates.isError ? (
              <TriangleAlert {...props} strokeWidth={2} />
            ) : (
              <CalendarHeart {...props} strokeWidth={2} />
            )
          }
          title={t(dates.isError ? 'dates.loadFailed' : 'dates.detail.notFoundTitle')}
          description={dates.isError ? undefined : t('dates.detail.notFoundBody')}
          actionLabel={dates.isError ? t('home.retry') : undefined}
          onActionPress={dates.isError ? () => void dates.refetch() : undefined}
        />
      </View>
    );
  }

  const tile = tileDayMonth(item);
  const weekday = weekdayIndex(item.nextOccurrence);
  const heroMeta = [
    weekday !== null ? t(`date.weekdays.${weekday}`) : null,
    formatDayMonth(item.nextOccurrence),
    item.isLunar ? t('dates.meta.lunar', { month: item.month, day: item.day }) : null,
    item.repeatsYearly ? t('dates.meta.everyYear') : t('dates.meta.once'),
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

  const memories = (gallery.data?.items ?? [])
    .filter((media) => media.shared)
    .slice(0, MEMORY_CAP);

  const label = occasionLabel(item);

  /** Ba lối tắt AI dùng chung một bộ params — người + dịp đã chọn sẵn.
   *  Label ghép đúng công thức OccasionSheet để cache server không vỡ. */
  const makerParams = {
    ...(member !== undefined
      ? { memberId: member.memberId, memberName: member.displayName }
      : {}),
    occasion: occasionParam(item, label),
    occasionDate: item.nextOccurrence,
    occasionType: item.type,
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton fallback="/dates" />}
        center={<ScreenTitle title={label} />}
        right={
          item.id !== null ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/dates/new',
                  params: {
                    id: item.id!,
                    familyId: item.familyId ?? '',
                    scope: item.scope,
                  },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={t('dates.detail.edit')}
              hitSlop={8}
              style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
            >
              <PenLine size={18} color={colors.text.primary} strokeWidth={2} />
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={{
          ...contentColumn,
          paddingTop: spacing.xl,
          paddingBottom: 40,
          gap: 15,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- hero đếm ngược (thẻ coral nhạt, mockup 12d) ---- */}
        <Animated.View
          entering={enter.up(0)}
          style={{
            backgroundColor: colors.coral.light,
            borderRadius: radius['4xl'],
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 13,
          }}
        >
          <DateTile day={tile.day} month={t(`date.months.${tile.month}`)} tone="card" />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text serif weight="bold" style={{ fontSize: 19, lineHeight: 24 }}>
              {t('dates.detail.inDays', { count: item.daysUntil })}
            </Text>
            <Text variant="caption" color={colors.coral.deep}>
              {heroMeta}
            </Text>
          </View>
        </Animated.View>

        {/* ---- ai giữ + ai được nhắc ---- */}
        <Animated.View entering={enter.up(1)}>
          <Card padding={8}>
            <SelectRow
              bare
              leading={
                <IconBadge
                  size={34}
                  background={colors.background.subtle}
                  foreground={colors.text.muted}
                  renderIcon={(props) => <Users {...props} strokeWidth={2.1} />}
                />
              }
              title={
                item.scope === 'PERSONAL'
                  ? t('dates.detail.keptByYou')
                  : t('dates.detail.keptBy', {
                      name: item.familyName ?? '',
                      count: familyDetail.data?.members.length ?? 0,
                    })
              }
              trailing="none"
            />
            <View style={{ height: 1, backgroundColor: colors.state.borderDefault }} />
            <SelectRow
              bare
              leading={
                <IconBadge
                  size={34}
                  background={colors.background.subtle}
                  foreground={colors.text.muted}
                  renderIcon={(props) => <Bell {...props} strokeWidth={2.1} />}
                />
              }
              title={
                item.id === null || item.remindDaysBefore === null
                  ? t('dates.detail.remindedDefault')
                  : item.remindDaysBefore === 0
                    ? t('dates.detail.remindedOnDay')
                    : t('dates.detail.remindedBefore', { count: item.remindDaysBefore })
              }
              subtitle={item.id === null ? t('dates.detail.fromProfile', { name: member?.displayName ?? '' }) : null}
              trailing="none"
            />
          </Card>
        </Animated.View>

        {/* ---- kỷ niệm về người trong ngày ---- */}
        {member !== undefined && item.familyId !== null && memories.length > 0 && (
          <Animated.View entering={enter.up(2)} style={{ gap: 9 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text
                variant="caption"
                weight="semibold"
                color={colors.text.secondary}
                style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 0.6 }}
              >
                {t('dates.detail.memories', { name: member.displayName })}
              </Text>
              <Text variant="badge" color={colors.text.lightMuted}>
                {t('dates.detail.photoCount', { count: gallery.data?.photoCount ?? memories.length })}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: 'row', gap: 10 }}
            >
              {memories.map((media) => (
                <Pressable
                  key={media.id}
                  onPress={() =>
                    router.push({
                      pathname: '/media/[id]',
                      params: { id: media.id, mime: media.mimeType },
                    })
                  }
                  accessibilityRole="button"
                  style={{ width: 104, gap: 5 }}
                >
                  <Image
                    source={thumbnailSource(media.id, media.mimeType)}
                    recyclingKey={media.id}
                    contentFit="cover"
                    transition={140}
                    style={{
                      width: 104,
                      height: 104,
                      borderRadius: radius.xl,
                      backgroundColor: colors.background.subtle,
                    }}
                  />
                  <Text variant="badge" color={colors.text.lightMuted} numberOfLines={1}>
                    {formatDayMonth(media.createdAt.slice(0, 10)) ?? ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* ---- make something for the day ---- */}
        <Animated.View entering={enter.up(3)} style={{ gap: 9 }}>
          <Text
            variant="caption"
            weight="semibold"
            color={colors.text.secondary}
            style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}
          >
            {t('dates.detail.make')}
          </Text>
          <Card padding={8}>
            <SelectRow
              bare
              leading={
                <IconBadge
                  size={34}
                  background={colors.background.subtle}
                  foreground={colors.text.muted}
                  renderIcon={(props) => <Gift {...props} strokeWidth={2.1} />}
                />
              }
              title={t('ai.giftIdeas')}
              onPress={() => router.push({ pathname: '/ai/gifts', params: makerParams })}
            />
            <View style={{ height: 1, backgroundColor: colors.state.borderDefault }} />
            <SelectRow
              bare
              leading={
                <IconBadge
                  size={34}
                  background={colors.background.subtle}
                  foreground={colors.text.muted}
                  renderIcon={(props) => <Mail {...props} strokeWidth={2.1} />}
                />
              }
              title={t('ai.hub.messageCard')}
              onPress={() => router.push({ pathname: '/ai/message', params: makerParams })}
            />
            <View style={{ height: 1, backgroundColor: colors.state.borderDefault }} />
            <SelectRow
              bare
              leading={
                <IconBadge
                  size={34}
                  background={colors.background.subtle}
                  foreground={colors.text.muted}
                  renderIcon={(props) => <Clapperboard {...props} strokeWidth={2.1} />}
                />
              }
              title={t('ai.hub.memoryVideo')}
              onPress={() => router.push({ pathname: '/video/setup', params: makerParams })}
            />
          </Card>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { CalendarHeart, Film, Gift, Mail, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { specialDateIcon, specialDateKindKey } from '../../src/components/ai/occasion-kind';
import { DateTile } from '../../src/components/ai/date-tile';
import { SelectRow } from '../../src/components/ai/select-row';
import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { NotificationBell, ScreenTitle } from '../../src/components/layout/header-slots';
import { Avatar } from '../../src/components/ui/avatar';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { EmptyState } from '../../src/components/ui/empty-state';
import { IconBadge } from '../../src/components/ui/icon-badge';
import { Text } from '../../src/components/ui/text';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useOccasionLabel, useSpecialDates } from '../../src/features/ai/use-special-dates';
import { families, type SpecialDateItem } from '../../src/lib/api';
import { formatDayMonth } from '../../src/lib/date';
import { queryKeys } from '../../src/lib/query-keys';
import { colors, radius, spacing, useLayout } from '../../src/theme';

/**
 * Room the floating bottom bar needs at the end of the scroll.
 *
 * Only while the bar is at the bottom. From 1024px up the same destinations
 * are a rail down the left, which overlaps nothing, so reserving this much
 * there would just be 140px of dead space under the last row.
 */
const BOTTOM_INSET = 140;

/** Icon-tile colours of the MAKE SOMETHING rows — straight from the mockup. */
const MAKE_TILES = {
  gift: colors.coral.primary,
  message: colors.coral.hover,
  video: '#9C6F9F',
} as const;

function makeTile(bg: string, icon: (props: { size: number; color: string }) => React.ReactNode) {
  return (
    <View
      style={{
        width: 42,
        height: 42,
        borderRadius: radius.xl,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon({ size: 20, color: colors.text.white })}
    </View>
  );
}

/** Weekday of a plain `YYYY-MM-DD`, parsed by hand so the day never drifts. */
function weekdayIndex(isoDate: string): number | null {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getDay();
}

/** Danh tính ổn định của một dịp — làm key cho hàng và cho lựa chọn nổi bật.
 * Title luôn góp mặt: một người có thể có hai dịp CUSTOM cùng ngày, chỉ khác tên. */
function dateKey(item: SpecialDateItem): string {
  return `${item.type}-${item.nextOccurrence}-${item.members[0]?.memberId ?? ''}-${item.title ?? ''}`;
}

/**
 * The AI tab — the "Present" home of the mockups.
 *
 * "Coming up" opens on the dates the family actually keeps (special-dates
 * API), and every action chip leads straight into a maker flow with the
 * person and the occasion already filled in.
 */
export default function AiScreen() {
  const { t } = useTranslation();
  const { expanded } = useLayout();
  const router = useRouter();
  const { familyId } = useActiveFamily();
  const dates = useSpecialDates(familyId);
  // Danh sách thành viên chỉ để lấy ảnh: mốc ngày chỉ mang id và tên người
  const family = useQuery({
    queryKey: queryKeys.family(familyId ?? 'none'),
    queryFn: () => families.detail(familyId as string),
    enabled: familyId !== null,
  });
  const occasionLabel = useOccasionLabel();
  const [showAll, setShowAll] = useState(false);
  // Bấm một hàng "Also this season" thì dịp đó lên thẻ nổi bật (xem bên dưới).
  const [featuredKey, setFeaturedKey] = useState<string | null>(null);

  const items = dates.data?.items ?? [];
  const thisMonth = items.filter((i) => i.daysUntil <= 31).length;
  // Thẻ nổi bật cần một gương mặt: chỉ dịp CÓ thành viên mới lên thẻ. Dịp CUSTOM
  // không người vẫn hợp lệ — nó nằm trong danh sách, và không chiếm chỗ của thẻ.
  const featured: SpecialDateItem | undefined =
    items.find((i) => dateKey(i) === featuredKey && i.members.length > 0) ??
    items.find((i) => i.members.length > 0);

  const featuredMember = featured?.members[0] ?? null;
  const featuredShown = Boolean(featured && featuredMember);
  const others = featuredShown ? items.filter((i) => i !== featured) : items;
  const restCap = featuredShown ? 2 : 4;
  const rest = others.slice(0, showAll ? undefined : restCap);
  const featuredOccasion = featured
    ? `${occasionLabel(featured)}${formatDayMonth(featured.nextOccurrence) ? ` · ${formatDayMonth(featured.nextOccurrence)}` : ''}`
    : null;

  /** "Sunday 30 Aug · in 11 days" */
  const featuredMeta = featured
    ? [
        weekdayIndex(featured.nextOccurrence) !== null
          ? t(`date.weekdays.${weekdayIndex(featured.nextOccurrence)}`)
          : null,
        formatDayMonth(featured.nextOccurrence),
      ]
        .filter(Boolean)
        .join(' ') + ` · ${t('ai.daysAway', { count: featured.daysUntil })}`
    : null;

  /** Chip trên thẻ nổi bật — mang sẵn người và dịp. Các hàng MAKE SOMETHING mở maker trống. */
  const pushMaker = (pathname: '/ai/gifts' | '/ai/message' | '/video/setup') =>
    router.push({
      pathname,
      params:
        featured && featuredMember
          ? {
              memberId: featuredMember.memberId,
              memberName: featuredMember.displayName,
              occasion: featuredOccasion ?? '',
              occasionDate: featured.nextOccurrence,
            }
          : {},
    });

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        center={<ScreenTitle title={t('nav.ai')} />}
        right={<NotificationBell />}
        paddingRight={spacing.lg}
      />

      <ScrollView
        contentContainerStyle={{
          ...contentColumn,
          paddingTop: 14,
          paddingBottom: expanded ? spacing['4xl'] : BOTTOM_INSET,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 6 }}>
          <Text
            serif
            weight="bold"
            accessibilityRole="header"
            style={{ fontSize: 27, lineHeight: 34, letterSpacing: -0.4 }}
          >
            {t('ai.hub.comingUp')}
          </Text>
          {/* Chỉ đếm khi đã tải xong — đang tải hay lỗi mà nói "0 dates" là nói sai. */}
          {dates.isSuccess && items.length > 0 && (
            <Text variant="body2" color={colors.text.muted}>
              {t('ai.hub.datesThisMonth', { count: thisMonth })}
            </Text>
          )}
        </View>

        {/* Lỗi tải có lối thử lại; MAKE SOMETHING bên dưới vẫn dùng được.
            Chỉ khi KHÔNG còn dữ liệu cũ — refetch nền thất bại trên cache còn
            tốt thì nội dung vẫn đứng, không chồng thêm một "load failed". */}
        {dates.isError && !dates.data && (
          <EmptyState
            renderIcon={({ size, color }) => (
              <TriangleAlert size={size} color={color} strokeWidth={2} />
            )}
            title={t('ai.hub.loadFailed')}
            actionLabel={t('common.retry')}
            onActionPress={() => void dates.refetch()}
          />
        )}

        {/* Mốc ngày sinh ra từ ngày sinh trên hồ sơ — chưa có thì chỉ đường sang gia đình. */}
        {dates.isSuccess && items.length === 0 && (
          <EmptyState
            renderIcon={({ size, color }) => (
              <CalendarHeart size={size} color={color} strokeWidth={2} />
            )}
            title={t('ai.hub.noDatesTitle')}
            description={t('ai.hub.noDatesBody')}
            actionLabel={t('ai.hub.noDatesAction')}
            onActionPress={() => router.push('/family')}
          />
        )}

        {/* ---------- featured: the next date that needs a decision ---------- */}
        {featured && featuredMember && (
          <View
            style={{
              backgroundColor: colors.coral.light,
              borderRadius: radius['4xl'],
              padding: 15,
              gap: 13,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {/* Ảnh người của dịp này. `SpecialDateItem.members` chỉ mang id và
                  tên, nên ảnh tra từ danh sách thành viên của gia đình. */}
              <Avatar
                size={46}
                name={featuredMember.displayName}
                mediaId={
                  family.data?.members.find((m) => m.id === featuredMember.memberId)?.avatarKey ??
                  null
                }
              />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text
                  variant="subtitle"
                  weight="semibold"
                  style={{ letterSpacing: -0.15 }}
                  numberOfLines={1}
                >
                  {occasionLabel(featured)}
                </Text>
                <Text variant="caption" color={colors.text.muted} numberOfLines={1}>
                  {featuredMeta}
                </Text>
              </View>
              <IconBadge
                size={36}
                background={colors.coral.primary}
                foreground={colors.text.white}
                renderIcon={specialDateIcon(featured.type)}
              />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button
                label={t('ai.giftIdeas')}
                size="small"
                onPress={() => pushMaker('/ai/gifts')}
                renderIcon={({ size, color }) => (
                  <Gift size={size} color={color} strokeWidth={2.1} />
                )}
              />
              <Button
                label={t('ai.hub.message')}
                variant="neutral"
                size="small"
                onPress={() => pushMaker('/ai/message')}
                renderIcon={({ size, color }) => (
                  <Mail size={size} color={color} strokeWidth={2.1} />
                )}
              />
              <Button
                label={t('ai.video')}
                variant="neutral"
                size="small"
                onPress={() => pushMaker('/video/setup')}
                renderIcon={({ size, color }) => (
                  <Film size={size} color={color} strokeWidth={2.1} />
                )}
              />
            </View>
          </View>
        )}

        {/* ---------- ALSO THIS SEASON ---------- */}
        {rest.length > 0 && (
          <View style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                variant="badge"
                weight="semibold"
                color={colors.text.lightMuted}
                style={{ letterSpacing: 0.7, textTransform: 'uppercase' }}
              >
                {t('ai.hub.alsoThisSeason')}
              </Text>
              {others.length > restCap && (
                <Pressable
                  onPress={() => setShowAll((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showAll }}
                  hitSlop={8}
                >
                  <Text variant="caption" weight="semibold" color={colors.coral.hover}>
                    {showAll ? t('common.close') : t('ai.hub.seeAll')}
                  </Text>
                </Pressable>
              )}
            </View>

            <Card padding={8} style={{ gap: 2 }}>
              {/* Bấm một hàng để đưa dịp đó lên thẻ nổi bật — dịp nào cũng có đủ ba chip. */}
              {rest.map((item, index) => (
                <Pressable
                  key={dateKey(item)}
                  // Dịp không có thành viên không lên thẻ được — hàng đó đứng yên
                  // thay vì bấm vào mà thẻ nổi bật biến mất.
                  disabled={item.members.length === 0}
                  onPress={() => setFeaturedKey(dateKey(item))}
                  accessibilityRole={item.members.length > 0 ? 'button' : undefined}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    padding: 6,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.state.borderDefault,
                    backgroundColor:
                      pressed && item.members.length > 0
                        ? colors.background.surfaceSoft
                        : 'transparent',
                  })}
                >
                  <DateTile day={item.day} month={t(`date.months.${item.month}`)} />
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Text variant="body2" weight="semibold" numberOfLines={1}>
                      {occasionLabel(item)}
                    </Text>
                    <Text variant="caption" color={colors.text.muted} numberOfLines={1}>
                      {t('ai.daysAway', { count: item.daysUntil })} ·{' '}
                      {t(specialDateKindKey(item.type))}
                    </Text>
                  </View>
                  <IconBadge
                    size={32}
                    background={colors.background.subtle}
                    foreground={colors.text.muted}
                    renderIcon={specialDateIcon(item.type)}
                  />
                </Pressable>
              ))}
            </Card>
          </View>
        )}

        {/* ---------- MAKE SOMETHING ---------- */}
        <View style={{ gap: 10 }}>
          <Text
            variant="badge"
            weight="semibold"
            color={colors.text.lightMuted}
            style={{ letterSpacing: 0.7, textTransform: 'uppercase' }}
          >
            {t('ai.hub.makeSomething')}
          </Text>

          <SelectRow
            leading={makeTile(MAKE_TILES.gift, (p) => (
              <Gift {...p} strokeWidth={2.1} />
            ))}
            title={t('ai.giftIdeas')}
            subtitle={t('ai.hub.giftIdeasDesc')}
            onPress={() => router.push('/ai/gifts')}
          />
          <SelectRow
            leading={makeTile(MAKE_TILES.message, (p) => (
              <Mail {...p} strokeWidth={2.1} />
            ))}
            title={t('ai.hub.messageCard')}
            subtitle={t('ai.hub.messageCardDesc')}
            onPress={() => router.push('/ai/message')}
          />
          <SelectRow
            leading={makeTile(MAKE_TILES.video, (p) => (
              <Film {...p} strokeWidth={2.1} />
            ))}
            title={t('ai.hub.memoryVideo')}
            subtitle={t('ai.hub.memoryVideoDesc')}
            onPress={() => router.push('/video/setup')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

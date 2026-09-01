import { useRouter } from 'expo-router';
import { ChevronRight, Images, Plus, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { DateRow } from '../../src/components/dates/date-row';
import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { NotificationBell, ScreenTitle } from '../../src/components/layout/header-slots';
import { Card } from '../../src/components/ui/card';
import { EmptyState } from '../../src/components/ui/empty-state';
import { IconBadge } from '../../src/components/ui/icon-badge';
import { Text } from '../../src/components/ui/text';
import { dateDetailParams } from '../../src/features/dates/date-meta';
import { useMyDates } from '../../src/features/dates/use-my-dates';
import { useFamilies } from '../../src/features/family/use-families';
import type { FamilySummary } from '../../src/lib/api';
import { mediaSource } from '../../src/lib/media-source';
import { colors, radius, spacing, useLayout } from '../../src/theme';
import { enter } from '../../src/theme/motion';
import { Image } from 'expo-image';

/** Room the floating bottom bar needs at the end of the scroll. */
const BOTTOM_INSET = 140;

/** How many rows join the entrance cascade on first paint (Home's rule). */
const CASCADE_ROWS = 5;

function FamilyRow({ family, onPress }: { family: FamilySummary; onPress: () => void }) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('omoide.openFamily', { name: family.name })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        borderRadius: radius['2xl'],
        backgroundColor: pressed ? colors.background.subtle : colors.background.card,
        boxShadow: `inset 0 0 0 1px ${colors.state.borderDefault}`,
      })}
    >
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: radius.xl,
          overflow: 'hidden',
          backgroundColor: colors.coral.light,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {family.coverMediaId === null ? (
          <Images size={22} color={colors.coral.deep} strokeWidth={2} />
        ) : (
          <Image
            source={mediaSource(family.coverMediaId)}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={160}
            accessibilityIgnoresInvertColors
          />
        )}
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body1" weight="semibold" numberOfLines={1}>
          {family.name}
        </Text>
        <Text variant="caption" color={colors.text.muted}>
          {t('omoide.familyMembers', { count: family.memberCount })}
        </Text>
      </View>

      <ChevronRight size={18} color={colors.text.lightMuted} strokeWidth={2.2} />
    </Pressable>
  );
}

/**
 * The shelf, one family at a time.
 *
 * This tab used to be a single wall of pictures belonging to whichever family
 * happened to be active — which meant somebody in three families could only
 * ever see a third of their photographs, and had to leave Omoide to change
 * which third. It lists the families instead, and each one opens its own
 * shelf (owner's call, 2026-08-28).
 *
 * Your private albums stay here rather than moving inside a family, because
 * they belong to nobody else: the line between "everyone in this family can
 * see this" and "only I can" should not be one you cross by accident.
 */
export default function OmoideScreen() {
  const { t } = useTranslation();
  const { expanded } = useLayout();
  const router = useRouter();

  const { data: families, isPending, isError, refetch } = useFamilies();
  // "Dates we keep" (12a) — feed tổng hợp xuyên mọi nhà + ngày riêng, cố ý
  // KHÔNG dùng useActiveFamily: tab này vừa bỏ khái niệm "nhà đang chọn"
  // (28/08) và mục ngày không được lén đưa nó quay lại.
  const myDates = useMyDates();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.page }}>
      <AppHeader
        center={<ScreenTitle title={t('nav.omoide')} />}
        right={<NotificationBell />}
        paddingRight={spacing.lg}
      />

      {renderBody()}
    </View>
  );

  function renderBody() {
    if (isError) {
      return (
        <EmptyState
          renderIcon={({ size, color }) => (
            <TriangleAlert size={size} color={color} strokeWidth={2} />
          )}
          title={t('omoide.loadFailed')}
          actionLabel={t('home.retry')}
          onActionPress={() => void refetch()}
        />
      );
    }

    if (isPending || families === undefined) return null;

    if (families.length === 0) {
      return (
        <EmptyState
          cat
          renderIcon={({ size, color }) => <Images size={size} color={color} strokeWidth={2} />}
          title={t('home.noFamilyTitle')}
          description={t('omoide.noFamilyBody')}
          actionLabel={t('home.startFamily')}
          onActionPress={() => router.push('/family/new')}
          secondaryActionLabel={t('joinFamily.heading')}
          onSecondaryActionPress={() => router.push('/join-family')}
        />
      );
    }

    return (
      <ScrollView
        contentContainerStyle={{
          ...contentColumn,
          paddingTop: 14,
          paddingBottom: expanded ? spacing['4xl'] : BOTTOM_INSET,
          gap: 10,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Kept above the families, and visibly apart from them: this shelf is
            the one nobody else can open. */}
        <Animated.View entering={enter.up(0)}>
          <Pressable
            onPress={() => router.push('/albums')}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: radius.xl,
              backgroundColor: colors.background.card,
              boxShadow: `inset 0 0 0 1px ${colors.state.borderDefault}`,
            }}
          >
            <IconBadge
              size={30}
              background={colors.coral.light}
              foreground={colors.coral.deep}
              renderIcon={(props) => <Images {...props} strokeWidth={2.1} />}
            />

            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="body2" weight="semibold">
                {t('omoide.yourAlbums')}
              </Text>
              <Text variant="badge" color={colors.text.subtle}>
                {t('omoide.yourAlbumsHint')}
              </Text>
            </View>

            <ChevronRight size={17} color={colors.text.lightMuted} strokeWidth={2.2} />
          </Pressable>
        </Animated.View>

        <Text
          variant="caption"
          weight="semibold"
          color={colors.text.secondary}
          style={{ paddingTop: 6 }}
        >
          {t('omoide.families')}
        </Text>

        {families.map((family, index) => (
          <Animated.View key={family.id} entering={enter.up(index < CASCADE_ROWS ? index + 1 : 0)}>
            <FamilyRow
              family={family}
              onPress={() =>
                router.push({ pathname: '/omoide/[familyId]', params: { familyId: family.id } })
              }
            />
          </Animated.View>
        ))}

        {/* ---- Dates we keep (12a) — chỉ vẽ khi feed về; lỗi thì ẩn cả mục:
             danh sách nhà phía trên đã là nơi báo lỗi tải của tab này, một ô
             lỗi thứ hai chồng lên chỉ thêm ồn. ---- */}
        {myDates.isSuccess && (
          <Animated.View entering={enter.up(0)} style={{ gap: 9, paddingTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text
                variant="caption"
                weight="semibold"
                color={colors.text.secondary}
                style={{ flex: 1 }}
              >
                {t('dates.title')}
              </Text>
              {myDates.data.length > 0 && (
                <Pressable
                  onPress={() => router.push('/dates')}
                  accessibilityRole="button"
                  hitSlop={8}
                >
                  <Text variant="caption" weight="semibold" color={colors.coral.deep}>
                    {t('dates.seeAll', { count: myDates.data.length })}
                  </Text>
                </Pressable>
              )}
            </View>

            <Card padding={8}>
              {myDates.data.slice(0, 2).map((item, index) => (
                <DateRow
                  key={item.id ?? `${item.type}-${item.familyId}-${item.members[0]?.memberId ?? index}`}
                  item={item}
                  trailing="chevron"
                  meta="kind"
                  divider={index > 0}
                  onPress={() =>
                    router.push({ pathname: '/dates/[id]', params: dateDetailParams(item) })
                  }
                />
              ))}
              {/* hàng "Add a date" — luôn có, kể cả khi chưa có ngày nào:
                  chính cái nút là lý do mục này tồn tại */}
              <Pressable
                onPress={() => router.push('/dates/new')}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                  padding: 6,
                  borderTopWidth: myDates.data.length > 0 ? 1 : 0,
                  borderTopColor: colors.state.borderDefault,
                  backgroundColor: pressed ? colors.background.surfaceSoft : 'transparent',
                })}
              >
                <IconBadge
                  size={44}
                  background={colors.background.subtle}
                  foreground={colors.text.muted}
                  renderIcon={(props) => <Plus {...props} strokeWidth={2.1} />}
                />
                <Text variant="body2" weight="semibold" style={{ flex: 1 }}>
                  {t('dates.addDate')}
                </Text>
                <ChevronRight size={17} color={colors.text.subtle} strokeWidth={2} />
              </Pressable>
            </Card>
          </Animated.View>
        )}
      </ScrollView>
    );
  }
}

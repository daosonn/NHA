import { useRouter } from 'expo-router';
import { ChevronRight, Images, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, SectionList, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { NotificationBell, ScreenTitle } from '../../src/components/layout/header-slots';
import { EmptyState } from '../../src/components/ui/empty-state';
import { IconBadge } from '../../src/components/ui/icon-badge';
import { Text } from '../../src/components/ui/text';
import { GRID_GAP, PhotoRow } from '../../src/components/omoide/photo-row';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useFamilyPhotos, type PhotoTile } from '../../src/features/omoide/use-family-photos';
import { formatFullDate } from '../../src/lib/date';
import { colors, radius, spacing } from '../../src/theme';

/** Room for the bottom nav plus the home indicator. */
const BOTTOM_INSET = 120;

/**
 * The family's shared pictures, newest day first.
 *
 * The MVP is one shelf rather than a set of albums (decided 2026-08-18):
 * everything anyone shared with this family, grouped by the day it arrived.
 * Albums by occasion — mockup 10a — wait for an endpoint and for a decision
 * about what an album is derived from.
 *
 * Drawn to mockup 10b. Two controls from that mockup are deliberately
 * absent: search and the sort menu have nothing behind them yet, and a
 * button that leads nowhere costs more trust than a visibly missing feature
 * (`docs/project-status.md` → Important Decisions).
 */
export default function OmoideScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { familyId } = useActiveFamily();

  const { days, total, contributors, isPending, isError, refetch, ...feed } =
    useFamilyPhotos(familyId);

  const openMoment = (tile: PhotoTile) =>
    router.push({ pathname: '/post/[id]', params: { id: tile.postId } });

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

    if (isPending || familyId === null) return null;

    if (days.length === 0) {
      return (
        <EmptyState
          renderIcon={({ size, color }) => <Images size={size} color={color} strokeWidth={2} />}
          title={t('omoide.emptyTitle')}
          description={t('omoide.emptyBody')}
        />
      );
    }

    return (
      <SectionList
        sections={days.map((day) => ({ ...day, data: day.rows }))}
        keyExtractor={(row, index) => `${row[0]?.id ?? 'row'}-${index}`}
        // The date heading stays put while its own photos scroll under it,
        // so you always know what you are looking at.
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: BOTTOM_INSET }}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        ListHeaderComponent={
          <View
            style={{ paddingHorizontal: spacing.xl, paddingTop: 14, paddingBottom: 4, gap: 10 }}
          >
            <Text variant="body2" color={colors.text.muted}>
              {t('omoide.summary', { photos: total, people: contributors })}
            </Text>

            {/* The way in to the private shelf, from the tab someone already
                opens to look at pictures. Kept visually separate from the
                shelf below it, which is the family's and is shared — one tap
                between "everyone can see this" and "only I can" needs the
                line drawn clearly. */}
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
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 8,
              paddingHorizontal: spacing.xl,
              paddingTop: 12,
              paddingBottom: 9,
              backgroundColor: colors.background.page,
            }}
          >
            <Text variant="body1" weight="bold" style={{ letterSpacing: -0.2 }}>
              {formatFullDate(section.date) ?? section.date}
            </Text>

            <Text
              variant="caption"
              color={colors.text.lightMuted}
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {section.place ?? ''}
            </Text>

            <Text variant="caption" weight="medium" color={colors.text.subtle}>
              {section.count}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: GRID_GAP }}>
            <PhotoRow tiles={item} onPress={openMoment} />
          </View>
        )}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator color={colors.coral.primary} style={{ paddingVertical: 16 }} />
          ) : null
        }
      />
    );
  }
}

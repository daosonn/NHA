import { useLocalSearchParams, useRouter } from 'expo-router';
import { Images, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, SectionList, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumnBleed } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { PhotoRow, GRID_GAP } from '../../src/components/omoide/photo-row';
import { Avatar } from '../../src/components/ui/avatar';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Text } from '../../src/components/ui/text';
import { useFamilyTree } from '../../src/features/family/use-family-tree';
import { useFamilyPhotos, type PhotoTile } from '../../src/features/omoide/use-family-photos';
import { formatFullDate } from '../../src/lib/date';
import { colors, radius, spacing, useLayout } from '../../src/theme';
import { enter } from '../../src/theme/motion';

/** Room the floating bottom bar needs at the end of the scroll. */
const BOTTOM_INSET = 140;

/** How many photo rows join the entrance cascade on first paint (Home's rule). */
const CASCADE_ROWS = 5;

/**
 * One family's pictures, newest day first — what the Omoide tab used to be
 * before it became a list of families.
 *
 * The row of faces along the top opens a person's own album. Only members
 * with an account appear there (owner's call, 2026-08-28): a placeholder can
 * be tagged, but tapping one would land on a profile nobody has filled in.
 *
 * **A person's album is not scoped to this family**, and the copy is careful
 * not to imply it is. `GET /families/:id/members/:id/gallery` answers with
 * every photo that person authored or was tagged in *that the viewer may
 * see* — across all the families they share. Narrowing it to one family was
 * considered and turned down (owner's call, 2026-08-28): a person is one
 * person, and the viewer's own permissions are already the honest limit.
 */
export default function FamilyPhotosScreen() {
  const { t } = useTranslation();
  const { expanded } = useLayout();
  const router = useRouter();
  const { familyId } = useLocalSearchParams<{ familyId: string }>();

  const tree = useFamilyTree(familyId ?? null);
  const { days, total, contributors, isPending, isError, refetch, ...feed } = useFamilyPhotos(
    familyId ?? null,
  );

  // Chạm vào một ô ở đây là muốn XEM tấm đó, không phải đọc bài đăng của nó.
  const openMoment = (tile: PhotoTile) =>
    router.push({ pathname: '/media/[id]', params: { id: tile.id, mime: tile.mimeType } });

  // Only linked members: a placeholder's album would open a profile with
  // nothing in it, which reads as a broken link rather than an empty one.
  const people = (tree.data?.members ?? []).filter((member) => member.userId !== null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.page }}>
      <AppHeader
        left={<BackButton />}
        center={<ScreenTitle title={tree.data?.name ?? t('nav.omoide')} />}
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

    if (isPending) return null;

    if (days.length === 0) {
      return (
        <EmptyState
          cat
          renderIcon={({ size, color }) => <Images size={size} color={color} strokeWidth={2} />}
          title={t('omoide.emptyTitle')}
          description={t('omoide.emptyBody')}
        />
      );
    }

    // Vị trí toàn cục của từng hàng, vì SectionList chỉ đưa index trong section.
    let rowOffset = 1;
    const sections = days.map((day) => {
      const section = { ...day, data: day.rows, offset: rowOffset };
      rowOffset += day.rows.length;
      return section;
    });

    return (
      <SectionList
        sections={sections}
        keyExtractor={(row, index) => `${row[0]?.id ?? 'row'}-${index}`}
        stickySectionHeadersEnabled
        contentContainerStyle={{
          ...contentColumnBleed,
          paddingBottom: expanded ? spacing['4xl'] : BOTTOM_INSET,
        }}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        ListHeaderComponent={
          <Animated.View entering={enter.up(0)} style={{ paddingTop: 14, gap: 12 }}>
            <Text
              variant="body2"
              color={colors.text.muted}
              style={{ paddingHorizontal: spacing.xl }}
            >
              {t('omoide.summary', { photos: total, people: contributors })}
            </Text>

            {people.length > 0 && (
              <View style={{ gap: 7 }}>
                <Text
                  variant="caption"
                  weight="semibold"
                  color={colors.text.secondary}
                  style={{ paddingHorizontal: spacing.xl }}
                >
                  {t('omoide.byPerson')}
                </Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    gap: 14,
                    paddingHorizontal: spacing.xl,
                    paddingBottom: 2,
                  }}
                >
                  {people.map((member) => (
                    <Pressable
                      key={member.id}
                      onPress={() =>
                        router.push({
                          pathname: '/member/[id]',
                          params: { id: member.id, tab: 'album' },
                        })
                      }
                      accessibilityRole="button"
                      accessibilityLabel={t('omoide.openPersonAlbum', {
                        name: member.displayName,
                      })}
                      style={{ alignItems: 'center', gap: 5, width: 62 }}
                    >
                      <Avatar size={52} name={member.displayName} mediaId={member.avatarKey} />
                      <Text variant="badge" color={colors.text.secondary} numberOfLines={1}>
                        {member.displayName}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </Animated.View>
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
        renderItem={({ item, index, section }) => {
          const cascadeIndex = section.offset + index;
          return (
            <Animated.View
              entering={enter.up(cascadeIndex < CASCADE_ROWS ? cascadeIndex : 0)}
              style={{ paddingHorizontal: spacing.md, paddingBottom: GRID_GAP }}
            >
              <PhotoRow tiles={item} onPress={openMoment} />
            </Animated.View>
          );
        }}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator color={colors.coral.primary} style={{ paddingVertical: 16 }} />
          ) : null
        }
      />
    );
  }
}

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Camera, Images, PenLine, Plus, TriangleAlert, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, SectionList, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Sheet } from '../../src/components/ai/sheet';
import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumnBleed } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { PhotoRow, GRID_GAP } from '../../src/components/omoide/photo-row';
import { Avatar } from '../../src/components/ui/avatar';
import { Button } from '../../src/components/ui/button';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Text } from '../../src/components/ui/text';
import { useToast } from '../../src/components/ui/toast';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useFamilies } from '../../src/features/family/use-families';
import { useFamilyTree } from '../../src/features/family/use-family-tree';
import { useFamilyPhotos, type PhotoTile } from '../../src/features/omoide/use-family-photos';
import { families } from '../../src/lib/api';
import { formatFullDate } from '../../src/lib/date';
import { mediaSource, thumbnailSource } from '../../src/lib/media-source';
import { queryKeys } from '../../src/lib/query-keys';
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
  const toast = useToast();
  const queryClient = useQueryClient();
  const { setFamilyId } = useActiveFamily();
  // Hero 13a cần address + năm lập nhà — list families đã có sẵn cả hai.
  const summary = useFamilies().data?.find((f) => f.id === familyId);

  // "Manage" và "Invite" đều dẫn tới tab cây — nơi quản lý thành viên và
  // luồng mời đã sống đủ; chuyển nhà đang chọn TRƯỚC để cây mở đúng nhà này.
  const goManage = (invite: boolean) => {
    if (familyId) setFamilyId(familyId);
    router.push(invite ? { pathname: '/family', params: { invite: '1' } } : '/family');
  };

  // Chạm vào một ô ở đây là muốn XEM tấm đó, không phải đọc bài đăng của nó.
  const openMoment = (tile: PhotoTile) =>
    router.push({ pathname: '/media/[id]', params: { id: tile.id, mime: tile.mimeType } });

  // Giữ lâu một ẢNH → đặt làm ảnh bìa nhà (Sơn yêu cầu 01/09 — trước đó
  // coverMediaId chỉ đọc, không có đường nào đặt từ UI). Video không làm
  // bìa được nên giữ-lâu video không mở gì.
  const [coverPick, setCoverPick] = useState<PhotoTile | null>(null);
  const setCover = useMutation({
    mutationFn: (mediaId: string) => families.setCover(familyId as string, mediaId),
    onSuccess: () => {
      // Bìa hiện ở list nhà (Omoide tab + group strip Home) và trong tree/detail.
      void queryClient.invalidateQueries({ queryKey: queryKeys.families() });
      setCoverPick(null);
      toast.success(t('omoide.coverSet'));
    },
    onError: () => toast.failure(t('omoide.coverFailed')),
  });
  const pickCover = (tile: PhotoTile) => {
    if (!tile.mimeType.startsWith('image/')) return;
    setCoverPick(tile);
  };

  // Only linked members: a placeholder's album would open a profile with
  // nothing in it, which reads as a broken link rather than an empty one.
  const people = (tree.data?.members ?? []).filter((member) => member.userId !== null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.page }}>
      <AppHeader
        left={<BackButton />}
        center={<ScreenTitle title={tree.data?.name ?? t('nav.omoide')} />}
        right={
          <Pressable
            onPress={() =>
              router.push({ pathname: '/family/edit', params: { familyId: familyId ?? '' } })
            }
            accessibilityRole="button"
            accessibilityLabel={t('family.edit.title')}
            hitSlop={8}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
          >
            <PenLine size={18} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
        }
      />
      {renderBody()}

      {/* Xác nhận đặt bìa — có ảnh xem trước để biết mình vừa giữ trúng tấm nào. */}
      <Sheet
        visible={coverPick !== null}
        onClose={() => setCoverPick(null)}
        title={t('omoide.coverTitle')}
        subtitle={t('omoide.coverBody', { name: tree.data?.name ?? '' })}
      >
        {coverPick !== null && (
          <View style={{ gap: 14, alignItems: 'center' }}>
            <Image
              source={thumbnailSource(coverPick.id, coverPick.mimeType)}
              recyclingKey={coverPick.id}
              contentFit="cover"
              style={{
                width: 96,
                height: 96,
                borderRadius: radius.xl,
                backgroundColor: colors.background.subtle,
              }}
              accessibilityIgnoresInvertColors
            />
            <Button
              label={t('omoide.coverConfirm')}
              variant="primary"
              size="large"
              fullWidth
              loading={setCover.isPending}
              onPress={() => setCover.mutate(coverPick.id)}
            />
          </View>
        )}
      </Sheet>
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
          <Animated.View entering={enter.up(0)} style={{ paddingTop: 10, gap: 14 }}>
            {/* ---- hero 13a: bìa tròn + tên lớn + dòng phụ + chips ---- */}
            <View style={{ alignItems: 'center', gap: 11, paddingHorizontal: spacing.xl }}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: radius.full,
                  overflow: 'hidden',
                  backgroundColor: colors.coral.light,
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 0 3px ${colors.background.card}, 0 4px 16px rgba(24,24,27,0.1)`,
                }}
              >
                {summary?.coverMediaId ? (
                  <Image
                    source={mediaSource(summary.coverMediaId)}
                    contentFit="cover"
                    style={{ width: '100%', height: '100%' }}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <Images size={28} color={colors.coral.deep} strokeWidth={2} />
                )}
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text serif weight="bold" style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.3 }}>
                  {tree.data?.name ?? ''}
                </Text>
                {(summary?.address || summary?.createdAt) && (
                  <Text variant="caption" color={colors.text.muted} numberOfLines={1}>
                    {[
                      summary?.address ?? null,
                      summary?.createdAt
                        ? t('omoide.since', { year: summary.createdAt.slice(0, 4) })
                        : null,
                    ]
                      .filter((part): part is string => part !== null)
                      .join(' · ')}
                  </Text>
                )}
                {summary?.about ? (
                  <Text
                    variant="caption"
                    color={colors.text.secondary}
                    numberOfLines={2}
                    style={{ textAlign: 'center', maxWidth: 300 }}
                  >
                    {summary.about}
                  </Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View
                  style={{
                    height: 34,
                    paddingHorizontal: 14,
                    borderRadius: radius.full,
                    backgroundColor: colors.background.card,
                    boxShadow: `inset 0 0 0 1px ${colors.state.borderDefault}`,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Users size={14} color={colors.text.muted} strokeWidth={2.2} />
                  <Text variant="caption" weight="semibold">
                    {t('omoide.membersChip', { count: tree.data?.members.length ?? 0 })}
                  </Text>
                </View>
                <View
                  style={{
                    height: 34,
                    paddingHorizontal: 14,
                    borderRadius: radius.full,
                    backgroundColor: colors.background.card,
                    boxShadow: `inset 0 0 0 1px ${colors.state.borderDefault}`,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Camera size={14} color={colors.text.muted} strokeWidth={2.2} />
                  <Text variant="caption" weight="semibold">
                    {t('omoide.photosChip', { count: total })}
                  </Text>
                </View>
              </View>
            </View>

            {people.length > 0 && (
              <View style={{ gap: 7 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: 8,
                    paddingHorizontal: spacing.xl,
                  }}
                >
                  <Text
                    variant="caption"
                    weight="semibold"
                    color={colors.text.secondary}
                    style={{ flex: 1 }}
                  >
                    {t('omoide.byPerson')}
                  </Text>
                  <Pressable onPress={() => goManage(false)} accessibilityRole="button" hitSlop={8}>
                    <Text variant="caption" weight="semibold" color={colors.coral.deep}>
                      {t('omoide.manage')}
                    </Text>
                  </Pressable>
                </View>

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

                  {/* ô "Invite" nét đứt cuối dải (13a) — cùng ngôn ngữ hình
                      với mọi chỗ-còn-trống khác trong app */}
                  <Pressable
                    onPress={() => goManage(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('omoide.invite')}
                    style={{ alignItems: 'center', gap: 5, width: 62 }}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: radius.full,
                        borderWidth: 1.5,
                        borderStyle: 'dashed',
                        borderColor: colors.coral.borderSoft,
                        backgroundColor: colors.coral.subtle,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Plus size={19} color={colors.coral.deep} strokeWidth={2.2} />
                    </View>
                    <Text variant="badge" color={colors.text.secondary} numberOfLines={1}>
                      {t('omoide.invite')}
                    </Text>
                  </Pressable>
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
              <PhotoRow tiles={item} onPress={openMoment} onLongPress={pickCover} />
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

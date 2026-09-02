import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { MemberProfile } from '../../features/member/member-profile';
import { useLifeEvents } from '../../features/member/use-life-events';
import { useMemberGallery } from '../../features/member/use-member-gallery';
import { useDeleteMemo, useMemberMemos, useMyMemos } from '../../features/member/use-memos';
import { families, type MemoDetail } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { colors } from '../../theme';
import { enter, swapIn } from '../../theme/motion';
import { SegmentedTabs } from '../ui/segmented-tabs';
import { Text } from '../ui/text';
import { useToast } from '../ui/toast';
import { AlbumGrid } from './album-grid';
import { MemoActionsSheet } from './memo-actions-sheet';
import { MemoList } from './memo-list';
import { ProfileFacts } from './profile-facts';
import { ProfileHero } from './profile-hero';
import { TimelineList } from './timeline-list';

type Tab = 'timeline' | 'album' | 'memo';

export type ProfileBodyProps = {
  profile: MemberProfile;
  /** The family these sections are read through. Null while none is active. */
  familyId: string | null;
  /** This person's row in that family. */
  memberId: string | null;
  /** True on your own Profile tab, which reads the `/me` routes. */
  ownProfile?: boolean;
  onEdit?: () => void;
  /**
   * Opens the staged timeline editor (mockup "Edit timeline"). Only the own
   * profile passes it — the same 2026-08-19 editability rule as `onEdit`;
   * a placeholder's wiki-editable timeline is the open product question.
   */
  onEditTimeline?: () => void;
  onChangeAvatar?: () => void;
  uploadingAvatar?: boolean;
  /** Xem tấm chân dung toàn màn hình (chỉ đưa khi có ảnh thật để xem). */
  onViewAvatar?: () => void;
  onAddMemo?: () => void;
  onOpenMemo?: (memo: MemoDetail) => void;
  onEditMemo?: (memo: MemoDetail) => void;
  onOpenMoment?: (postId: string) => void;
  /** Mở một tấm ảnh lẻ của tab Album trong trình xem toàn màn hình. */
  onOpenPhoto?: (item: { id: string; mimeType: string }) => void;
  /** Which tab opens first. Omoide arrives here wanting the album. */
  initialTab?: Tab;
  /** Start a post with no audience. Only wired on your own page. */
  onAddPrivate?: () => void;
};

/**
 * A Life Profile, minus the screen around it.
 *
 * Your own profile and someone else's are the same object viewed from
 * different angles — the differences are already carried by the data
 * (`editability`, `relation`), so both screens render this and only supply
 * their own header and scroll padding.
 *
 * The memo sheet and the delete dialog live here rather than in the two
 * routes: they are the same state on both, and a second copy is a second
 * thing to keep in step. Navigation stays with the routes, handed down as
 * callbacks.
 */
export function ProfileBody({
  profile,
  familyId,
  memberId,
  ownProfile = false,
  onEdit,
  onEditTimeline,
  onChangeAvatar,
  uploadingAvatar,
  onViewAvatar,
  onAddMemo,
  onOpenMemo,
  onEditMemo,
  onOpenMoment,
  onOpenPhoto,
  initialTab = 'timeline',
  onAddPrivate,
}: ProfileBodyProps) {
  const { t } = useTranslation();
  const toast = useToast();

  // Openable straight onto a tab: Omoide sends people here to look at
  // somebody's photographs, and landing on the timeline first would make
  // them find the album themselves every time.
  const [tab, setTab] = useState<Tab>(initialTab);

  /**
   * Trên hồ sơ của CHÍNH BẠN, tab メモ hiện TOÀN BỘ sổ tay của bạn; trên hồ sơ
   * người khác thì chỉ những ghi chú bạn viết về người đó. Lý do: "ghi chú về
   * chính mình" không tồn tại, nên bản cũ luôn hiện trạng thái trống ở đây dù
   * sổ có cả chục ghi chú về người trong nhà.
   */
  const memberMemos = useMemberMemos(ownProfile ? null : familyId, ownProfile ? null : memberId);
  const myMemos = useMyMemos(ownProfile === true);
  const memos = ownProfile ? myMemos : memberMemos;
  const deleteMemo = useDeleteMemo();

  // Ảnh cho tiêu đề từng nhóm ghi chú — chỉ cần trên hồ sơ của chính mình
  const family = useQuery({
    queryKey: queryKeys.family(familyId ?? 'none'),
    queryFn: () => families.detail(familyId as string),
    enabled: ownProfile === true && familyId !== null,
  });
  const people = useMemo(
    () =>
      (family.data?.members ?? []).map((m) => ({
        memberId: m.id,
        displayName: m.displayName,
        avatarKey: m.avatarKey,
      })),
    [family.data],
  );

  const timeline = useLifeEvents({ own: ownProfile, familyId, memberId });
  const events = timeline.data ?? [];

  const gallery = useMemberGallery({ own: ownProfile, familyId, memberId });

  const [acting, setActing] = useState<MemoDetail | null>(null);

  const list = memos.data ?? [];

  return (
    <View style={{ gap: 16 }}>
      <Animated.View entering={enter.up(0)}>
        <ProfileHero
          profile={profile}
          onEdit={onEdit}
          onChangeAvatar={onChangeAvatar}
          uploadingAvatar={uploadingAvatar}
          onViewAvatar={onViewAvatar}
        />
      </Animated.View>

      <Animated.View entering={enter.up(1)}>
        <ProfileFacts profile={profile} />
      </Animated.View>

      <Animated.View entering={enter.up(2)}>
        <SegmentedTabs
          accessibilityLabel={t('member.sections', { name: profile.displayName })}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'timeline', label: t('member.timeline'), count: events.length },
            { value: 'album', label: t('member.album'), count: gallery.data?.photoCount ?? 0 },
            { value: 'memo', label: t('member.memo'), count: list.length },
          ]}
        />
      </Animated.View>

      {tab === 'timeline' && (
        <Animated.View entering={swapIn} style={{ gap: 12 }}>
          {/* The mockup's "Dad's journey · Edit" row — drawn only where the
              editor is offered, so other people's pages are untouched. */}
          {onEditTimeline !== undefined && events.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}
            >
              <Text serif weight="bold" style={{ fontSize: 22, lineHeight: 28 }}>
                {t('member.journeyOwn')}
              </Text>
              <Pressable
                onPress={onEditTimeline}
                accessibilityRole="button"
                accessibilityLabel={t('member.editTimeline.title')}
                hitSlop={8}
              >
                <Text variant="caption" weight="semibold" color={colors.coral.dark}>
                  {t('member.editTimelineLink')}
                </Text>
              </Pressable>
            </View>
          )}

          <TimelineList
            events={events}
            loading={timeline.isPending && (ownProfile || memberId !== null)}
            failed={timeline.isError}
            onRetry={() => void timeline.refetch()}
            onAddEvent={onEditTimeline}
            // The same viewer the Album tab opens. A photo is a photo
            // wherever it is drawn.
            onOpenPhoto={onOpenPhoto}
          />
        </Animated.View>
      )}
      {tab === 'album' && (
        <Animated.View entering={swapIn}>
          <AlbumGrid
            gallery={gallery.data}
            memberName={profile.displayName}
            own={ownProfile}
            loading={gallery.isPending && (ownProfile || memberId !== null)}
            failed={gallery.isError}
            onRetry={() => void gallery.refetch()}
            onOpenPhoto={onOpenPhoto}
            onAddPrivate={ownProfile ? onAddPrivate : undefined}
            // Chạm = xem ảnh; giữ = mở bài đăng gốc (nếu ảnh thuộc một bài)
            onOpenMoment={onOpenMoment}
          />
        </Animated.View>
      )}
      {tab === 'memo' && (
        <Animated.View entering={swapIn}>
          <MemoList
            memos={list}
            memberName={profile.displayName}
            own={ownProfile}
            people={people}
            loading={memos.isPending && (ownProfile === true || memberId !== null)}
            failed={memos.isError}
            onRetry={() => void memos.refetch()}
            onAddMemo={onAddMemo}
            onOpenMemo={onOpenMemo}
            onMemoActions={setActing}
          />
        </Animated.View>
      )}

      {/* One sheet for both steps. Deleting used to hand off to a second
          `Modal`, which meant dismissing one and presenting another on the
          same tick — they overlapped on screen. */}
      <MemoActionsSheet
        memo={acting}
        onClose={() => setActing(null)}
        onEdit={(memo) => {
          setActing(null);
          onEditMemo?.(memo);
        }}
        onDelete={(memo) => {
          // No undo: a real DELETE takes the media files with it, so putting
          // the note back would mean writing a new one that has lost its
          // photos. The confirm step carries that — see `use-memos.ts`.
          deleteMemo.mutate(memo, {
            // Cùng khoá với memo/[id].tsx: một hành động thì một câu trả lời.
            onSuccess: () => toast.success(t('member.memoDelete.toast')),
          });
          setActing(null);
        }}
      />
    </View>
  );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { MemberProfile } from '../../features/member/member-profile';
import { useLifeEvents } from '../../features/member/use-life-events';
import { useMemberMoments } from '../../features/member/use-member-moments';
import { useDeleteMemo, useMemberMemos } from '../../features/member/use-memos';
import type { MemoDetail, PostDetail } from '../../lib/api';
import { SegmentedTabs } from '../ui/segmented-tabs';
import { AlbumGrid } from './album-grid';
import { MemoActionsSheet } from './memo-actions-sheet';
import { MemoDeleteDialog } from './memo-delete-dialog';
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
  onAddMemo?: () => void;
  onOpenMemo?: (memo: MemoDetail) => void;
  onEditMemo?: (memo: MemoDetail) => void;
  onOpenMoment?: (moment: PostDetail) => void;
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
  onAddMemo,
  onOpenMemo,
  onEditMemo,
  onOpenMoment,
}: ProfileBodyProps) {
  const { t } = useTranslation();

  const [tab, setTab] = useState<Tab>('timeline');

  const memos = useMemberMemos(familyId, memberId);
  const deleteMemo = useDeleteMemo();

  const timeline = useLifeEvents({ own: ownProfile, familyId, memberId });
  const events = timeline.data ?? [];

  const moments = useMemberMoments(familyId, memberId, profile.userId);

  const [acting, setActing] = useState<MemoDetail | null>(null);
  const [confirming, setConfirming] = useState<MemoDetail | null>(null);

  const list = memos.data ?? [];

  const confirmDelete = () => {
    if (confirming === null) return;

    // No undo: a real DELETE takes the media files with it, so putting the
    // note back would mean writing a new one that has lost its photos. The
    // dialog carries the weight instead — see `use-memos.ts`.
    deleteMemo.mutate(confirming);
    setConfirming(null);
  };

  return (
    <View style={{ gap: 16 }}>
      <ProfileHero profile={profile} onEdit={onEdit} />

      <ProfileFacts profile={profile} />

      <SegmentedTabs
        accessibilityLabel={t('member.sections', { name: profile.displayName })}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'timeline', label: t('member.timeline'), count: events.length },
          { value: 'album', label: t('member.album'), count: moments.data?.items.length ?? 0 },
          { value: 'memo', label: t('member.memo'), count: list.length },
        ]}
      />

      {tab === 'timeline' && (
        <TimelineList
          events={events}
          loading={timeline.isPending && (ownProfile || memberId !== null)}
          failed={timeline.isError}
          onRetry={() => void timeline.refetch()}
        />
      )}
      {tab === 'album' && (
        <AlbumGrid
          moments={moments.data}
          memberName={profile.displayName}
          own={ownProfile}
          // Distinct from "nothing to show": with no family on screen there
          // is no feed to read, and the empty state should not blame the
          // absence of photographs for the absence of a family.
          noFamily={familyId === null || memberId === null}
          loading={moments.isPending && familyId !== null && memberId !== null}
          failed={moments.isError}
          onRetry={() => void moments.refetch()}
          onOpenMoment={onOpenMoment}
        />
      )}
      {tab === 'memo' && (
        <MemoList
          memos={list}
          memberName={profile.displayName}
          loading={memos.isPending && memberId !== null}
          failed={memos.isError}
          onRetry={() => void memos.refetch()}
          onAddMemo={onAddMemo}
          onOpenMemo={onOpenMemo}
          onMemoActions={setActing}
        />
      )}

      <MemoActionsSheet
        memo={acting}
        onClose={() => setActing(null)}
        onEdit={(memo) => {
          setActing(null);
          onEditMemo?.(memo);
        }}
        onDelete={(memo) => {
          setActing(null);
          setConfirming(memo);
        }}
      />

      <MemoDeleteDialog
        visible={confirming !== null}
        photoCount={confirming?.media.length ?? 0}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(null)}
      />
    </View>
  );
}

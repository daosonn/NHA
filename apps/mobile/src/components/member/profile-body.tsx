import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { MemberProfile, MemoItem } from '../../fixtures/member';
import { deleteMemo, useMemos } from '../../features/member/memo-store';
import { SegmentedTabs } from '../ui/segmented-tabs';
import { AlbumGrid } from './album-grid';
import { MemoActionsSheet } from './memo-actions-sheet';
import { MemoDeleteDialog } from './memo-delete-dialog';
import { MemoList } from './memo-list';
import { ProfileHero } from './profile-hero';
import { TimelineList } from './timeline-list';

type Tab = 'timeline' | 'album' | 'memo';

export type ProfileBodyProps = {
  profile: MemberProfile;
  onEdit?: () => void;
  onAddMemo?: () => void;
  onOpenMemo?: (memo: MemoItem) => void;
  onEditMemo?: (memo: MemoItem) => void;
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
 * callbacks, and the undo toast belongs to them too — it has to float over
 * the scroll view rather than inside it.
 */
export function ProfileBody({
  profile,
  onEdit,
  onAddMemo,
  onOpenMemo,
  onEditMemo,
}: ProfileBodyProps) {
  const { t } = useTranslation();

  const [tab, setTab] = useState<Tab>('timeline');

  // Notes come from the store rather than from `profile`, so a note written on
  // the editor screen is already here when that screen pops back.
  const memos = useMemos(profile.id);

  const [acting, setActing] = useState<MemoItem | null>(null);
  const [confirming, setConfirming] = useState<MemoItem | null>(null);

  const confirmDelete = () => {
    if (confirming === null) return;

    // The store holds the note for the length of the undo window; the toast
    // that offers it back is rendered by the route, over the scroll view.
    deleteMemo(profile.id, confirming.id);
    setConfirming(null);
  };

  return (
    <View style={{ gap: 20 }}>
      <ProfileHero profile={profile} onEdit={onEdit} />

      <SegmentedTabs
        accessibilityLabel={t('member.sections', { name: profile.displayName })}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'timeline', label: t('member.timeline'), count: profile.lifeEvents.length },
          { value: 'album', label: t('member.album'), count: profile.gallery.length },
          { value: 'memo', label: t('member.memo'), count: memos.length },
        ]}
      />

      {tab === 'timeline' && <TimelineList events={profile.lifeEvents} />}
      {tab === 'album' && <AlbumGrid items={profile.gallery} />}
      {tab === 'memo' && (
        <MemoList
          memos={memos}
          memberName={profile.displayName}
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
        photoCount={confirming?.photos.length ?? 0}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(null)}
      />
    </View>
  );
}

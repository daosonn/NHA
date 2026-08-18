import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { MemberProfile } from '../../fixtures/member';
import { SegmentedTabs } from '../ui/segmented-tabs';
import { AlbumGrid } from './album-grid';
import { MemoList } from './memo-list';
import { ProfileHero } from './profile-hero';
import { TimelineList } from './timeline-list';

type Tab = 'timeline' | 'album' | 'memo';

export type ProfileBodyProps = {
  profile: MemberProfile;
  onEdit?: () => void;
};

/**
 * A Life Profile, minus the screen around it.
 *
 * Your own profile and someone else's are the same object viewed from
 * different angles — the differences are already carried by the data
 * (`editability`, `relation`), so both screens render this and only supply
 * their own header and scroll padding.
 */
export function ProfileBody({ profile, onEdit }: ProfileBodyProps) {
  const { t } = useTranslation();

  const [tab, setTab] = useState<Tab>('timeline');

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
          { value: 'memo', label: t('member.memo'), count: profile.memos.length },
        ]}
      />

      {tab === 'timeline' && <TimelineList events={profile.lifeEvents} />}
      {tab === 'album' && <AlbumGrid items={profile.gallery} />}
      {tab === 'memo' && <MemoList memos={profile.memos} memberName={profile.displayName} />}
    </View>
  );
}

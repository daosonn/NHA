import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FamilyTree } from '../src/components/family/family-tree';
import { InviteSheet } from '../src/components/family/invite-sheet';
import { PendingBanner } from '../src/components/family/pending-banner';
import type { PositionedNode } from '../src/components/family/tree-layout';
import { GroupStrip } from '../src/components/home/group-strip';
import { AppHeader } from '../src/components/layout/app-header';
import { BackButton } from '../src/components/layout/header-slots';
import { SectionHeader } from '../src/components/ui/section-header';
import { Text } from '../src/components/ui/text';
import { familyTree } from '../src/fixtures/family';
import { familyGroups, remainingGroupCount } from '../src/fixtures/home';
import {
  defaultSpot,
  familyInviteCode,
  pendingInvite,
  type TreeSpot,
} from '../src/fixtures/invite';

/**
 * The family tree is a pushed screen, not a tab: it is reached by tapping the
 * group strip on Home, and it is a way *into* Life Profiles rather than a
 * destination of its own.
 */
export default function FamilyTreeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [spot, setSpot] = useState<TreeSpot | null>(null);

  const subtitle = [
    t('family.generations', { count: familyTree.generations.length }),
    t('family.members', { count: familyTree.memberCount }),
    familyTree.pendingCount > 0 ? t('family.pending', { count: familyTree.pendingCount }) : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');

  // An empty node is an invitation waiting to happen, so it opens the invite
  // sheet rather than a profile that does not exist yet.
  const openNode = (node: PositionedNode) => {
    if (node.state === 'empty') {
      setSpot({ id: node.id, summary: defaultSpot.summary });
      return;
    }
    router.push({ pathname: '/member/[id]', params: { id: node.id } });
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {t('family.title')}
          </Text>
        }
      />

      <View className="flex-1 gap-lg px-xl pb-xl pt-lg">
        <GroupStrip
          groups={familyGroups}
          remainingCount={remainingGroupCount}
          showTreeLink={false}
        />

        <SectionHeader title={familyTree.name} subtitle={subtitle} size="lg" />

        {/* The banner overlays the canvas, so it shares this wrapper's box. */}
        <View className="flex-1">
          <FamilyTree
            data={familyTree}
            onSelectNode={openNode}
            onAddMember={() => setSpot(defaultSpot)}
          />

          {familyTree.pendingCount > 0 && <PendingBanner invite={pendingInvite} />}
        </View>
      </View>

      <InviteSheet
        visible={spot !== null}
        onClose={() => setSpot(null)}
        spot={spot ?? defaultSpot}
        code={familyInviteCode}
      />
    </View>
  );
}

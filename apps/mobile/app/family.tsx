import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { FamilyTree } from '../src/components/family/family-tree';
import type { PositionedNode } from '../src/components/family/tree-layout';
import { GroupStrip } from '../src/components/home/group-strip';
import { AppHeader } from '../src/components/layout/app-header';
import { BackButton } from '../src/components/layout/header-slots';
import { SectionHeader } from '../src/components/ui/section-header';
import { Text } from '../src/components/ui/text';
import { familyTree } from '../src/fixtures/family';
import { familyGroups, remainingGroupCount } from '../src/fixtures/home';

/**
 * The family tree is a pushed screen, not a tab: it is reached by tapping the
 * group strip on Home, and it is a way *into* Life Profiles rather than a
 * destination of its own.
 */
export default function FamilyTreeScreen() {
  const router = useRouter();

  const subtitle = [
    `${familyTree.generations.length} generations`,
    `${familyTree.memberCount} members`,
    familyTree.pendingCount > 0 ? `${familyTree.pendingCount} pending` : null,
  ]
    .filter((part) => part !== null)
    .join(' · ');

  const openMember = (node: PositionedNode) => {
    if (node.state === 'empty') return;
    router.push({ pathname: '/member/[id]', params: { id: node.id } });
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            Family tree
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

        <FamilyTree data={familyTree} onSelectNode={openMember} />
      </View>
    </View>
  );
}

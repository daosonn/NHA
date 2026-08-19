import { useRouter } from 'expo-router';
import { TriangleAlert, UsersRound } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FamilyTree } from '../src/components/family/family-tree';
import { InviteSheet } from '../src/components/family/invite-sheet';
import type { PositionedNode } from '../src/components/family/tree-layout';
import { GroupStrip, type FamilyGroupSummary } from '../src/components/home/group-strip';
import { AppHeader } from '../src/components/layout/app-header';
import { BackButton } from '../src/components/layout/header-slots';
import { EmptyState } from '../src/components/ui/empty-state';
import { SectionHeader } from '../src/components/ui/section-header';
import { Text } from '../src/components/ui/text';
import { useSession } from '../src/features/auth/session';
import { useActiveFamily } from '../src/features/family/active-family';
import { treeFromGraph } from '../src/features/family/tree-from-graph';
import { useAddMember } from '../src/features/family/use-add-member';
import { useFamilies } from '../src/features/family/use-families';
import { useFamilyTree } from '../src/features/family/use-family-tree';
import { ApiError, type FamilySummary, type FamilyTree as FamilyTreePayload } from '../src/lib/api';
import { defaultSpot, type TreeSpot } from '../src/fixtures/invite';

const VISIBLE_GROUPS = 3;

function toStripGroups(families: FamilySummary[]): FamilyGroupSummary[] {
  return families.slice(0, VISIBLE_GROUPS).map((family, index) => ({
    id: family.id,
    name: family.name,
    tone: index % 2 === 0 ? 'light' : 'dark',
  }));
}

/**
 * The family tree is a pushed screen, not a tab: it is reached by tapping the
 * group strip on Home, and it is a way *into* Life Profiles rather than a
 * destination of its own.
 */
export default function FamilyTreeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useSession();
  const { familyId } = useActiveFamily();

  const { data: families } = useFamilies();
  const { data: payload, isPending, isError, refetch } = useFamilyTree(familyId);
  const addMember = useAddMember(familyId);

  const [spot, setSpot] = useState<TreeSpot | null>(null);

  // The invite sheet names the family whose code it is handing out, so the
  // sender can see which door they are opening.
  const activeFamily = families?.find((family) => family.id === familyId);

  const tree = useMemo(
    () =>
      payload === undefined
        ? null
        : treeFromGraph(payload, {
            viewerUserId: user?.id ?? null,
            generationLabel: (index) => t('family.generation', { index: index + 1 }),
            translate: t,
          }),
    [payload, user?.id, t],
  );

  const viewerMemberId = useMemo(
    () => findViewerMemberId(payload, user?.id ?? null),
    [payload, user?.id],
  );

  const subtitle =
    tree === null
      ? ''
      : [
          t('family.generations', { count: tree.generations.length }),
          t('family.members', { count: tree.memberCount }),
        ].join(' · ');

  // Every node is a real person now, so every tap opens a profile. Empty and
  // pending spots need a per-spot invite the server does not have yet.
  const openNode = (node: PositionedNode) => {
    router.push({ pathname: '/member/[id]', params: { id: node.id } });
  };

  const submitNewMember = ({
    name,
    option,
  }: Parameters<NonNullable<React.ComponentProps<typeof InviteSheet>['onSubmit']>>[0]) => {
    if (viewerMemberId === null) return;

    addMember.mutate(
      {
        displayName: name,
        anchorMemberId: viewerMemberId,
        type: option.type,
        newMemberIsFrom: option.newMemberIsFrom,
      },
      { onSuccess: () => setSpot(null) },
    );
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
        {families !== undefined && families.length > 0 && (
          <GroupStrip
            groups={toStripGroups(families)}
            remainingCount={Math.max(0, families.length - VISIBLE_GROUPS)}
            showTreeLink={false}
          />
        )}

        {isError ? (
          <EmptyState
            renderIcon={({ size, color }) => (
              <TriangleAlert size={size} color={color} strokeWidth={2} />
            )}
            title={t('family.loadFailed')}
            actionLabel={t('home.retry')}
            onActionPress={() => void refetch()}
          />
        ) : isPending || tree === null ? null : tree.memberCount === 0 ? (
          <EmptyState
            renderIcon={({ size, color }) => (
              <UsersRound size={size} color={color} strokeWidth={2} />
            )}
            title={t('family.emptyTitle')}
            description={t('family.emptyBody')}
            actionLabel={t('family.addMember')}
            onActionPress={() => setSpot(defaultSpot)}
          />
        ) : (
          <>
            <SectionHeader title={tree.name} subtitle={subtitle} size="lg" />

            <View className="flex-1">
              <FamilyTree
                data={tree}
                onSelectNode={openNode}
                onAddMember={() => setSpot(defaultSpot)}
              />
            </View>
          </>
        )}
      </View>

      <InviteSheet
        visible={spot !== null}
        onClose={() => setSpot(null)}
        spot={spot ?? defaultSpot}
        code={activeFamily?.inviteCode ?? ''}
        familyName={activeFamily?.name ?? ''}
        onSubmit={submitNewMember}
        submitting={addMember.isPending}
        errorKey={
          addMember.error === null
            ? null
            : addMember.error instanceof ApiError && addMember.error.isOffline
              ? 'errors.offline'
              : 'errors.generic'
        }
      />
    </View>
  );
}

/**
 * Which node is "you".
 *
 * A person can be in several families, so the tree is matched on the account
 * id rather than on a member id carried between screens.
 */
function findViewerMemberId(
  payload: FamilyTreePayload | undefined,
  userId: string | null,
): string | null {
  if (payload === undefined || userId === null) return null;
  return payload.members.find((member) => member.userId === userId)?.id ?? null;
}

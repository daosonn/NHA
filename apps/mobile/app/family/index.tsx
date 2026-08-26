import { useRouter } from 'expo-router';
import { LockKeyhole, TriangleAlert, UsersRound } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { FamilyTree } from '../../src/components/family/family-tree';
import { InviteSheet } from '../../src/components/family/invite-sheet';
import { MemberSheet } from '../../src/components/family/member-sheet';
import { PendingBanner } from '../../src/components/family/pending-banner';
import type { PositionedNode } from '../../src/components/family/tree-layout';
import { GroupStrip, type FamilyGroupSummary } from '../../src/components/home/group-strip';
import { AppHeader } from '../../src/components/layout/app-header';
import { ContentColumn } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { EmptyState } from '../../src/components/ui/empty-state';
import { SectionHeader } from '../../src/components/ui/section-header';
import { Text } from '../../src/components/ui/text';
import { useToast } from '../../src/components/ui/toast';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { treeFromGraph } from '../../src/features/family/tree-from-graph';
import {
  outstanding,
  useCreateInvitation,
  useFamilyInvitations,
  useResendInvitation,
} from '../../src/features/family/use-invitations';
import { useFamilies } from '../../src/features/family/use-families';
import { useRemoveMember, useSaveMember } from '../../src/features/family/use-member-mutations';
import { useFamilyTree } from '../../src/features/family/use-family-tree';
import {
  ApiError,
  type FamilySummary,
  type FamilyTree as FamilyTreePayload,
  type InvitationSummary,
} from '../../src/lib/api';
import { colors, radius } from '../../src/theme';

/**
 * Every group, not the first three: on this screen the strip is the switch
 * between trees, and a switch that hides half its positions is not one.
 */
function toStripGroups(families: FamilySummary[]): FamilyGroupSummary[] {
  return families.map((family) => ({
    id: family.id,
    name: family.name,
    coverMediaId: family.coverMediaId,
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
  const toast = useToast();
  const { user } = useSession();
  const { familyId, setFamilyId } = useActiveFamily();

  const { data: families } = useFamilies();
  const { data: payload, isPending, isError, refetch } = useFamilyTree(familyId);
  const saveMember = useSaveMember(familyId);
  const removeMember = useRemoveMember(familyId);

  const { data: invites } = useFamilyInvitations(familyId);
  const createInvitation = useCreateInvitation(familyId);
  const resendInvitation = useResendInvitation(familyId);

  const [inviting, setInviting] = useState(false);
  /** The invitation just created, which is what turns the sheet into its code state. */
  const [created, setCreated] = useState<InvitationSummary | null>(null);
  /** Which node is being managed, by id — the payload is the source of truth. */
  const [managingId, setManagingId] = useState<string | null>(null);

  // The invite sheet names the family whose code it is handing out, so the
  // sender can see which door they are opening.
  const activeFamily = families?.find((family) => family.id === familyId);

  /**
   * The spots being held for people who have been invited.
   *
   * Recomputed from the list rather than stored, because `EXPIRED` is derived
   * server-side at read time: an invitation that lapsed while this screen was
   * open is still `PENDING` in the cached payload, and a node left marked
   * pending forever would be a promise the app cannot keep.
   */
  const waiting = useMemo(() => outstanding(invites ?? [], Date.now()), [invites]);

  const pendingMemberIds = useMemo(
    () => new Set(waiting.map((invite) => invite.memberId)),
    [waiting],
  );

  /** Newest first from the server, so the head of the list is the one to name. */
  const newestInvite = waiting[0] ?? null;

  const tree = useMemo(
    () =>
      payload === undefined
        ? null
        : treeFromGraph(payload, {
            viewerUserId: user?.id ?? null,
            generationLabel: (index) => t('family.generation', { index: index + 1 }),
            translate: t,
            pendingMemberIds,
          }),
    [payload, user?.id, t, pendingMemberIds],
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

  /**
   * One request, and the server does the rest.
   *
   * It used to add a member and then hang an edge off it, which could leave an
   * unconnected person in the tree when the second call failed.
   * `POST /invitations` creates the placeholder, the edge and the invitation
   * in one transaction — and hands back the code that reserves that exact spot.
   *
   * The relationship is measured from the viewer's own node, so an account
   * that is not in this tree has nothing to measure from and cannot invite.
   */
  const sendInvitation = ({
    name,
    option,
  }: Parameters<NonNullable<React.ComponentProps<typeof InviteSheet>['onSubmit']>>[0]) => {
    if (viewerMemberId === null) return;

    createInvitation.mutate(
      {
        name,
        relationshipType: option.type,
        kinshipKey: option.value,
        newMemberIsFrom: option.newMemberIsFrom,
      },
      { onSuccess: setCreated },
    );
  };

  const closeInvite = () => {
    setInviting(false);
    setCreated(null);
    createInvitation.reset();
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader left={<BackButton />} center={<ScreenTitle title={t('family.title')} />} />

      <View className="flex-1 gap-lg px-xl pb-xl pt-lg">
        {families !== undefined && families.length > 0 && (
          /* The canvas below keeps the whole window — it is a map, and more
             room is more tree. The strip is not a map: capped, it stays with
             the header above it instead of drifting out to the edge. */
          <ContentColumn bleed>
            <GroupStrip
              groups={toStripGroups(families)}
              remainingCount={0}
              showTreeLink={false}
              activeId={familyId ?? undefined}
              onSelectGroup={setFamilyId}
              onAddPress={() => router.push('/family/new')}
            />
          </ContentColumn>
        )}

        {/* Lối vào nhóm khác bằng mã đọc miệng (mockup 7a). Trước đây chỉ
            người CHƯA có gia đình mới thấy màn Join (empty state ở Home) —
            người đang ở gia đình A được đọc mã vào gia đình B không có chỗ
            nào để gõ. Nút + ở dải trên vẫn là "tạo mới", đúng chủ đích của
            nó; đây là cánh cửa còn thiếu. */}
        {families !== undefined && families.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('family.joinBanner.action')}
            onPress={() => router.push({ pathname: '/create-family', params: { mode: 'join' } })}
            style={{
              height: 44,
              borderRadius: radius.lg,
              backgroundColor: colors.background.card,
              // Viền ấm của mockup, inset để không cộng vào chiều cao.
              boxShadow: 'inset 0 0 0 1.4px #F0DCC5',
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 9,
            }}
          >
            <LockKeyhole size={17} color={colors.coral.deep} strokeWidth={2.1} />
            <Text variant="body2" weight="medium" color={colors.text.muted} style={{ flex: 1 }}>
              {t('family.joinBanner.question')}
            </Text>
            <Text variant="body2" weight="semibold" color={colors.coral.deep}>
              {t('family.joinBanner.action')}
            </Text>
          </Pressable>
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
            cat
            renderIcon={({ size, color }) => (
              <UsersRound size={size} color={color} strokeWidth={2} />
            )}
            title={t('family.emptyTitle')}
            description={t('family.emptyBody')}
            actionLabel={t('family.addMember')}
            onActionPress={() => setInviting(true)}
          />
        ) : (
          <>
            {/* Ảnh cả nhà KHÔNG vẽ ở đây: nó là ảnh đại diện của gia đình, nên
                chỗ của nó là vòng tròn trong dải chuyển gia đình phía trên
                (thay chữ viết tắt), không phải một tấm bìa riêng. */}
            <SectionHeader title={tree.name} subtitle={subtitle} size="lg" />

            <View className="flex-1">
              <FamilyTree
                data={tree}
                onSelectNode={openNode}
                onManageNode={(node) => setManagingId(node.id)}
                onAddMember={() => setInviting(true)}
              />

              {/* One banner for all of them: a stack of these would bury the
                  tree they are drawn over. */}
              {newestInvite !== null && (
                <PendingBanner
                  invite={newestInvite}
                  otherCount={waiting.length - 1}
                  // Nothing on screen changes when this succeeds — the
                  // banner already said the same thing before the tap.
                  onResend={() =>
                    resendInvitation.mutate(newestInvite.id, {
                      onSuccess: () =>
                        toast.success(t('family.toast.resent', { name: newestInvite.name })),
                      onError: () => toast.failure(t('errors.generic')),
                    })
                  }
                  resending={resendInvitation.isPending}
                />
              )}
            </View>
          </>
        )}
      </View>

      {payload !== undefined && (
        <MemberSheet
          member={payload.members.find((member) => member.id === managingId) ?? null}
          tree={payload}
          anchorMemberId={viewerMemberId}
          viewerUserId={user?.id ?? null}
          onClose={() => setManagingId(null)}
          onSave={(edits) => {
            if (managingId === null) return;
            saveMember.mutate(
              { memberId: managingId, ...edits },
              { onSuccess: () => setManagingId(null) },
            );
          }}
          onRemove={() => {
            if (managingId === null) return;
            removeMember.mutate(managingId, {
              onSuccess: () => {
                setManagingId(null);
                toast.success(t('family.toast.removed'));
              },
            });
          }}
          saving={saveMember.isPending}
          removing={removeMember.isPending}
          errorKey={memberErrorKey(saveMember.error ?? removeMember.error)}
        />
      )}

      <InviteSheet
        visible={inviting}
        onClose={closeInvite}
        familyName={activeFamily?.name ?? ''}
        created={created}
        onSubmit={sendInvitation}
        submitting={createInvitation.isPending}
        errorKey={inviteErrorKey(createInvitation.error, viewerMemberId)}
      />
    </View>
  );
}

/**
 * Why an invitation could not be sent.
 *
 * The one worth separating out is having no node of your own in this tree:
 * every kinship word in the picker is measured from the inviter, so there is
 * nothing to attach the new spot to. It reads as a dead button otherwise.
 */
function inviteErrorKey(error: unknown, viewerMemberId: string | null): string | null {
  if (viewerMemberId === null) return 'invite.sheet.errors.noAnchor';
  if (error === null || error === undefined) return null;
  if (!(error instanceof ApiError)) return 'errors.generic';
  if (error.isOffline) return 'errors.offline';
  if (error.status === 403) return 'invite.sheet.errors.forbidden';
  return 'errors.generic';
}

/** Turns whatever the member routes threw into a line the sheet can show. */
function memberErrorKey(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  if (!(error instanceof ApiError)) return 'errors.generic';
  if (error.isOffline) return 'errors.offline';
  // The server refuses edits to an account holder who is not you.
  if (error.status === 403) return 'family.member.errors.forbidden';
  if (error.status === 409) return 'family.member.errors.duplicate';
  return 'errors.generic';
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

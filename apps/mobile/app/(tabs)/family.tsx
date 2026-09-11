import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockKeyhole, Send, TriangleAlert, UsersRound } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DeleteFamilySheet } from '../../src/components/family/delete-family-sheet';
import { FamilyTree } from '../../src/components/family/family-tree';
import { InviteSheet } from '../../src/components/family/invite-sheet';
import { MemberSheet } from '../../src/components/family/member-sheet';
import type { PositionedNode } from '../../src/components/family/tree-layout';
import type { SlotKind, TreeSlot } from '../../src/components/family/tree-slots';
import { GroupStrip, type FamilyGroupSummary } from '../../src/components/home/group-strip';
import { AppHeader } from '../../src/components/layout/app-header';
import { ContentColumn } from '../../src/components/layout/content-column';
import { ScreenTitle } from '../../src/components/layout/header-slots';
import { EmptyState } from '../../src/components/ui/empty-state';
import { SectionHeader } from '../../src/components/ui/section-header';
import { Text } from '../../src/components/ui/text';
import { useToast } from '../../src/components/ui/toast';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { slotEdge } from '../../src/features/family/kinship';
import { treeFromGraph } from '../../src/features/family/tree-from-graph';
import {
  outstanding,
  useCancelInvitation,
  useCreateInvitation,
  useFamilyInvitations,
} from '../../src/features/family/use-invitations';
import { useFamilies } from '../../src/features/family/use-families';
import {
  useDeleteFamily,
  useRemoveMember,
  useSaveMember,
} from '../../src/features/family/use-member-mutations';
import { useFamilyTree } from '../../src/features/family/use-family-tree';
import {
  ApiError,
  type FamilySummary,
  type FamilyTree as FamilyTreePayload,
  type InvitationSummary,
} from '../../src/lib/api';
import { colors, radius, useLayout } from '../../src/theme';

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
 * The family tree, a tab since 2026-08-26 (owner's call — it lived behind
 * Home's group strip, then briefly behind a raised centre disc on the bar;
 * now it is an ordinary destination beside Home and Omoide). Still the way
 * *into* Life Profiles, and still the screen where switching families lives:
 * the strip at the top switches trees, since it left Home the same day.
 */
export default function FamilyTreeScreen() {
  const { t } = useTranslation();
  const { expanded } = useLayout();
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
  const cancelInvitation = useCancelInvitation(familyId);

  const [inviting, setInviting] = useState(false);

  // ?invite=1 — nut Invite tren shelf Omoide (13a) nhay thang vao luong moi.
  // consumed-ref: chi ap mot lan moi luot toi, vi tab luon mounted.
  const inviteParam = useLocalSearchParams<{ invite?: string }>().invite;
  const consumedInvite = useRef(false);
  useEffect(() => {
    if (inviteParam === '1' && !consumedInvite.current) {
      consumedInvite.current = true;
      setInviting(true);
    }
    if (inviteParam !== '1') consumedInvite.current = false;
  }, [inviteParam]);
  /**
   * Chế độ chỉnh sửa cây (prototype `src/family-tree-canvas.html`,
   * 28/08): bút chì bật nó, chạm một người để chọn, các ô nét đứt quanh họ
   * là chỗ thêm được. Thêm bằng cách CHẠM VÀO CHỖ thay vì gõ quan hệ —
   * gõ nhầm quan hệ là lỗi hay gặp nhất của form cũ.
   */
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Ô vừa chạm — mở sheet mời với quan hệ đã chốt theo ô. */
  const [slotPick, setSlotPick] = useState<{
    kind: SlotKind;
    anchorId: string;
    anchorName: string;
  } | null>(null);
  /** The invitation just created, which is what turns the sheet into its code state. */
  const [created, setCreated] = useState<InvitationSummary | null>(null);
  /** Which node is being managed, by id — the payload is the source of truth. */
  const [managingId, setManagingId] = useState<string | null>(null);
  /** Nhà đang được hỏi "xóa nhé?" — `null` là sheet đóng. */
  const [deletingFamily, setDeletingFamily] = useState<FamilySummary | null>(null);
  const deleteFamily = useDeleteFamily();

  // The invite sheet names the family whose code it is handing out, so the
  // sender can see which door they are opening.
  const activeFamily = families?.find((family) => family.id === familyId);
  // Nút xóa chỉ vẽ cho người đã lập ra nhà — server cũng chặn lần nữa (403),
  // và còn từ chối nếu người khác vẫn ở trong (409).
  const canDeleteActive = activeFamily !== undefined && activeFamily.createdById === user?.id;

  const confirmDeleteFamily = (target: FamilySummary) => {
    deleteFamily.mutate(target.id, {
      onSuccess: () => {
        setDeletingFamily(null);
        // Nhảy sang nhà kế bên NGAY và ghi nhớ lựa chọn — không để nhà vừa
        // xóa đứng làm "nhà đang chọn" rồi tải cây của nó ra màn lỗi.
        const next = (families ?? []).find((family) => family.id !== target.id);
        if (next !== undefined) setFamilyId(next.id);
        else router.replace('/');
        toast.success(t('family.delete.toast'));
      },
    });
  };

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

  /**
   * The invitation still reserving each spot, cancelable per member.
   *
   * Wider than `waiting` on purpose: `EXPIRED` is derived from a row still
   * stored as PENDING, so it can be cancelled too — and it must be, or a
   * lapsed invite leaves a ghost placeholder in the tree. An invited PARENT
   * is the worst case: `hasChildren` blocks plain removal (the viewer hangs
   * below them), so cancelling the invitation is the only way that spot
   * comes back out.
   */
  const cancellableByMember = useMemo(() => {
    const byMember = new Map<string, InvitationSummary>();
    for (const invite of invites ?? []) {
      // Newest first from the server — the first one seen per spot wins.
      if (
        (invite.status === 'PENDING' || invite.status === 'EXPIRED') &&
        !byMember.has(invite.memberId)
      ) {
        byMember.set(invite.memberId, invite);
      }
    }
    return byMember;
  }, [invites]);

  const managedInvite = managingId === null ? null : (cancellableByMember.get(managingId) ?? null);

  const cancelInvite = (invite: InvitationSummary) => {
    cancelInvitation.mutate(invite.id, {
      onSuccess: () => {
        setManagingId(null);
        toast.success(t('family.toast.inviteCancelled', { name: invite.name }));
      },
      onError: () => toast.failure(t('errors.generic')),
    });
  };

  const tree = useMemo(
    () =>
      payload === undefined
        ? null
        : treeFromGraph(payload, {
            viewerUserId: user?.id ?? null,
            generationLabel: (index) => t('family.generation', { index: index + 1 }),
            unplacedLabel: t('family.unplacedRow'),
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

  // Every node is a real person now, so outside edit mode every tap opens a
  // profile. In edit mode a tap chooses instead — the slots draw around them.
  const openNode = (node: PositionedNode) => {
    if (editing) {
      setSelectedId((current) => (current === node.id ? null : node.id));
      return;
    }
    router.push({ pathname: '/member/[id]', params: { id: node.id } });
  };

  const toggleEditing = () => {
    setEditing((current) => !current);
    setSelectedId(null);
  };

  const pickSlot = (slot: TreeSlot) => {
    if (selectedId === null) return;
    const anchor = payload?.members.find((member) => member.id === selectedId);
    if (anchor === undefined) return;
    setSlotPick({ kind: slot.kind, anchorId: anchor.id, anchorName: anchor.displayName });
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
    email,
  }: Parameters<NonNullable<React.ComponentProps<typeof InviteSheet>['onSubmit']>>[0]) => {
    // Slot flow: the tapped spot already decided the edge AND who it hangs
    // off — the selected node, not the inviter.
    if (slotPick !== null) {
      const edge = slotEdge(slotPick.kind);
      createInvitation.mutate(
        {
          name,
          anchorMemberId: slotPick.anchorId,
          relationshipType: edge.type,
          kinshipKey: edge.kinshipKey,
          newMemberIsFrom: edge.newMemberIsFrom,
          ...(edge.gender === undefined ? {} : { gender: edge.gender }),
          ...(email === '' ? {} : { email }),
        },
        { onSuccess: setCreated },
      );
      return;
    }

    if (viewerMemberId === null || option === null) return;

    createInvitation.mutate(
      {
        name,
        relationshipType: option.type,
        kinshipKey: option.value,
        newMemberIsFrom: option.newMemberIsFrom,
        // Omitted rather than sent empty: the server validates the field when
        // it is present, so '' would fail as a malformed address instead of
        // meaning "no address given".
        ...(email === '' ? {} : { email }),
      },
      { onSuccess: setCreated },
    );
  };

  const closeInvite = () => {
    setInviting(false);
    setSlotPick(null);
    setCreated(null);
    createInvitation.reset();
  };

  return (
    <View className="flex-1 bg-page">
      {/* A tab since 2026-08-26 — no back arrow; the bar below is the way out. */}
      <AppHeader
        center={<ScreenTitle title={t('family.title')} />}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {/* Xóa nhà đã CHUYỂN xuống dưới cây, sau cái bút (2026-09-04,
                owner's call). Ở đây nó nằm cạnh nút điều hướng, một chạm là
                tới, trên chính màn hình mà việc thường làm là ngắm gia đình
                mình — mà xóa thì không hoàn tác được và cascade cả nhà. */}

            {/* Lời mời đã gửi sống sau nút này (badge = số đang chờ) — banner
                nổi trên canvas bị bỏ 2026-08-26 vì nó che đúng cái cây đang xem. */}
            <Pressable
              onPress={() => router.push('/family/invitations')}
              accessibilityRole="button"
              accessibilityLabel={
                waiting.length > 0
                  ? t('family.invitations.openWaiting', { count: waiting.length })
                  : t('family.invitations.title')
              }
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={21} color={colors.text.primary} strokeWidth={2} />

              {waiting.length > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 4,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    borderRadius: radius.full,
                    backgroundColor: colors.coral.primary,
                    borderWidth: 2,
                    borderColor: colors.background.page,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text variant="badge" weight="bold" color={colors.text.white}>
                    {waiting.length > 99 ? '99+' : String(waiting.length)}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        }
      />

      {/* Below 1024px the floating bar hangs over the canvas — the tree's own
          bottom controls (hint pill, add button) need to sit clear of it. */}
      <View className="flex-1 gap-lg px-xl pt-lg" style={{ paddingBottom: expanded ? 20 : 104 }}>
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
            onPress={() => router.push('/join-family')}
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
        ) : families !== undefined && families.length === 0 ? (
          /* No family at all — `tree === null` used to swallow this into a
             blank canvas. Same cat and same door as Home's no-family state. */
          <EmptyState
            cat
            renderIcon={({ size, color }) => (
              <UsersRound size={size} color={color} strokeWidth={2} />
            )}
            title={t('home.noFamilyTitle')}
            description={t('family.noFamilyBody')}
            actionLabel={t('home.startFamily')}
            onActionPress={() => router.push('/family/new')}
            secondaryActionLabel={t('joinFamily.heading')}
            onSecondaryActionPress={() => router.push('/join-family')}
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
                editing={editing}
                onToggleEditing={toggleEditing}
                onDeleteFamily={
                  canDeleteActive && activeFamily !== undefined
                    ? () => {
                        deleteFamily.reset();
                        setDeletingFamily(activeFamily);
                      }
                    : undefined
                }
                deleteFamilyLabel={
                  activeFamily === undefined
                    ? undefined
                    : t('family.delete.action', { name: activeFamily.name })
                }
                selectedId={selectedId}
                onPickSlot={pickSlot}
              />
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
          pendingInvite={managedInvite}
          onCancelInvite={() => {
            if (managedInvite !== null) cancelInvite(managedInvite);
          }}
          cancelling={cancelInvitation.isPending}
        />
      )}

      <InviteSheet
        visible={inviting || slotPick !== null}
        onClose={closeInvite}
        familyName={activeFamily?.name ?? ''}
        created={created}
        spot={slotPick === null ? null : { kind: slotPick.kind, anchorName: slotPick.anchorName }}
        onSubmit={sendInvitation}
        submitting={createInvitation.isPending}
        // Ở luồng slot, mỏ neo là node đang chọn — không cần node của chính
        // mình trong cây, nên lỗi "noAnchor" chỉ thuộc luồng form cũ.
        errorKey={inviteErrorKey(
          createInvitation.error,
          slotPick === null ? viewerMemberId : slotPick.anchorId,
        )}
        emailErrorKey={inviteEmailErrorKey(createInvitation.error)}
      />

      <DeleteFamilySheet
        family={deletingFamily}
        onClose={() => setDeletingFamily(null)}
        onConfirm={confirmDeleteFamily}
        deleting={deleteFamily.isPending}
        errorKey={deleteFamilyErrorKey(deleteFamily.error)}
      />
    </View>
  );
}

/** Vì sao không xóa được nhà — hai lý do server nói rõ, còn lại chung chung. */
function deleteFamilyErrorKey(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  if (!(error instanceof ApiError)) return 'errors.generic';
  if (error.isOffline) return 'errors.offline';
  if (error.status === 403) return 'family.delete.errors.forbidden';
  if (error.status === 409) return 'family.delete.errors.hasMembers';
  return 'errors.generic';
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
  // Handled on the field itself — saying it twice reads as two problems.
  if (error.status === 404 || error.status === 409) return null;
  return 'errors.generic';
}

/**
 * The two failures that are about the address, kept apart on purpose.
 *
 * 404 and 409 need different actions from the inviter — sign them up first
 * versus they are already here — and collapsing both into "something went
 * wrong" would leave the second one looking like a bug.
 */
function inviteEmailErrorKey(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 404) return 'invite.sheet.errors.emailUnknown';
  if (error.status === 409) return 'invite.sheet.errors.emailAlreadyMember';
  return null;
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

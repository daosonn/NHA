import { useMutation, useQueryClient } from '@tanstack/react-query';

import { families } from '../../lib/api';
import type { FamilySummary, Gender, RelationshipType } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/** Everything that can change about a person's place in the tree, in one save. */
export type MemberEdits = {
  memberId: string;
  displayName?: string;
  gender?: Gender;
  /** Omit to leave the relationship alone. */
  relationship?: {
    /** The edge to replace, if there is one. */
    currentId: string | null;
    /** The member the new edge attaches to — normally the viewer's own node. */
    anchorMemberId: string;
    type: RelationshipType;
    /** True when the edited member is the `from` end: a parent, in other words. */
    memberIsFrom: boolean;
  };
};

/**
 * Saves a member's name, gender and relationship together.
 *
 * The relationship is the awkward one. There is no `PATCH` for an edge, so
 * changing "sister" to "daughter" means deleting one row and creating
 * another — two requests that can half-succeed. If the create fails after the
 * delete landed, the person is still in the family but has come loose from
 * the tree, which is exactly the kind of silent damage nobody notices until
 * the screen looks wrong days later.
 *
 * So the delete happens **last**: create the new edge first, and only remove
 * the old one once the new one exists. A failure then leaves the old edge
 * standing and nothing is lost. If the delete is what fails, the member ends
 * up with two edges — visible, harmless, and fixable from this same sheet —
 * rather than none.
 *
 * Either way the tree is refetched, so what the screen shows is what the
 * server has rather than what the app hoped for.
 */
export function useSaveMember(familyId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, displayName, gender, relationship }: MemberEdits) => {
      if (familyId === null) throw new Error('No active family');

      if (displayName !== undefined || gender !== undefined) {
        await families.updateMember(familyId, memberId, {
          ...(displayName !== undefined && { displayName }),
          ...(gender !== undefined && { gender }),
        });
      }

      if (relationship !== undefined) {
        const { currentId, anchorMemberId, type, memberIsFrom } = relationship;

        await families.addRelationship(familyId, {
          fromMemberId: memberIsFrom ? memberId : anchorMemberId,
          toMemberId: memberIsFrom ? anchorMemberId : memberId,
          type,
        });

        if (currentId !== null) {
          await families.removeRelationship(familyId, currentId);
        }
      }
    },
    // Runs on success *and* on failure: a half-applied save is the case where
    // the screen most needs to stop guessing and re-read the server.
    onSettled: () => {
      if (familyId === null) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.family(familyId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.families() });
    },
  });
}

/**
 * Takes a member out of the family.
 *
 * Only ever offered for a leaf — see `canRemoveMember` — because removing
 * someone with children below them would cut the branch loose: the server
 * deletes their relationships with them, and the grandchildren lose their
 * only path to the rest of the tree. What happens to relationships that
 * routed through a removed person is still an open domain question
 * (`docs/00-shared/domain-model.md` → Open Questions), so the app declines to
 * answer it by accident.
 */
export function useRemoveMember(familyId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => {
      if (familyId === null) throw new Error('No active family');
      return families.removeMember(familyId, memberId);
    },
    onSettled: () => {
      if (familyId === null) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.family(familyId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.families() });
    },
  });
}

/**
 * Xóa cả một gia đình (tạo nhầm).
 *
 * Rút nhà khỏi danh sách trong cache NGAY (setQueryData) chứ không chỉ
 * invalidate: ActiveFamily tính nhà đang chọn từ danh sách này, nên phải đổi
 * trong cùng một nhịp render — đợi refetch thì có một khoảnh khắc nhà đã xóa
 * vẫn là "nhà đang chọn", cây của nó tải lại, server 403 và người dùng thấy
 * màn lỗi (đã dính 26/08). Cũng vì thế KHÔNG removeQueries cây của nhà đó:
 * gỡ cache khi observer còn mounted là ép nó refetch đúng cái 403 ấy; cache
 * cũ nằm im rồi tự gc, vô hại.
 */
export function useDeleteFamily() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (familyId: string) => families.remove(familyId),
    onSuccess: (_result, familyId) => {
      queryClient.setQueryData<FamilySummary[]>(queryKeys.families(), (current) =>
        current?.filter((family) => family.id !== familyId),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.families() });
    },
  });
}

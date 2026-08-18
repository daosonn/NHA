import { useMutation, useQueryClient } from '@tanstack/react-query';

import { families } from '../../lib/api';
import type { RelationshipType } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

export type AddMemberInput = {
  displayName: string;
  /** The person the new member is related to — normally the signed-in viewer. */
  anchorMemberId: string;
  type: RelationshipType;
  /** True when the new member is the `from` end — a parent, in other words. */
  newMemberIsFrom: boolean;
};

/**
 * Adds a placeholder to the tree and connects it, in that order.
 *
 * Two calls, because the API has no "add a related member" route: a member
 * exists first, and the edge is a second resource. If the edge fails the
 * member is left behind rather than rolled back — the server owns
 * transactions and the client must not pretend to. A stray unconnected
 * member is visible and fixable; a silent half-failure is not, so the error
 * is surfaced instead of swallowed.
 */
export function useAddMember(familyId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ displayName, anchorMemberId, type, newMemberIsFrom }: AddMemberInput) => {
      if (familyId === null) throw new Error('No active family');

      const member = await families.addMember(familyId, { displayName });

      await families.addRelationship(familyId, {
        fromMemberId: newMemberIsFrom ? member.id : anchorMemberId,
        toMemberId: newMemberIsFrom ? anchorMemberId : member.id,
        type,
      });

      return member;
    },
    onSuccess: () => {
      if (familyId === null) return;
      // The tree and the family's member list both changed.
      void queryClient.invalidateQueries({ queryKey: queryKeys.family(familyId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.families() });
    },
  });
}

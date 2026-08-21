import type { FamilyMemberSummary } from '../../lib/api';
import { useActiveFamily } from './active-family';
import { useFamilyTree } from './use-family-tree';

/**
 * The member row that stands for an account, inside the family on screen.
 *
 * Posts identify their author by `authorUserId`, but a Life Profile is opened
 * by member id — a person can sit in several families and has a member row in
 * each. This resolves one to the other using the family already loaded for
 * the tree, so tapping a face in the feed lands on the same profile the tree
 * would open.
 *
 * The **whole row**, not just the id: every caller that needs the id needs
 * the face too (`avatarKey`), and the server already resolves a linked
 * member's picture to their account's, so one person looks the same in every
 * family. An id-only pair used to live here and was folded into this on
 * 2026-08-21 — two ways to ask the same question is one too many.
 *
 * `null` is an ordinary answer, not a failure: the author may have left, or
 * may belong to a different family than the one being viewed. Callers should
 * draw initials and leave the avatar unpressable rather than guess.
 */
export function useMemberForUser(userId: string | null): FamilyMemberSummary | null {
  const lookup = useMemberLookup();
  return lookup(userId);
}

/**
 * The same resolution as a reusable function, for lists.
 *
 * `renderItem` is a callback rather than a component, so it cannot call a
 * hook per row — and calling one per row would be wasteful anyway, since
 * every row reads the same cached tree.
 */
export function useMemberLookup(): (userId: string | null) => FamilyMemberSummary | null {
  const { familyId } = useActiveFamily();
  const { data: tree } = useFamilyTree(familyId);

  return (userId) => {
    if (userId === null || tree === undefined) return null;
    return tree.members.find((member) => member.userId === userId) ?? null;
  };
}

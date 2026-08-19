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
 * `null` is an ordinary answer, not a failure: the author may have left, or
 * may belong to a different family than the one being viewed. Callers should
 * leave the avatar unpressable rather than guess.
 */
export function useMemberIdForUser(userId: string | null): string | null {
  const lookup = useMemberIdLookup();
  return lookup(userId);
}

/**
 * The same resolution as a reusable function, for lists.
 *
 * `renderItem` is a callback rather than a component, so it cannot call a
 * hook per row — and calling one per row would be wasteful anyway, since
 * every row reads the same cached tree.
 */
export function useMemberIdLookup(): (userId: string | null) => string | null {
  const { familyId } = useActiveFamily();
  const { data: tree } = useFamilyTree(familyId);

  return (userId) => {
    if (userId === null || tree === undefined) return null;
    return tree.members.find((member) => member.userId === userId)?.id ?? null;
  };
}

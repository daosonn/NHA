import type { FamilyMemberSummary, FamilyTree, RelationshipType } from '../../lib/api';

/** Edge types that mean "from is a parent of to", however that parenthood came about. */
const PARENTAL: RelationshipType[] = ['PARENT', 'ADOPTED_PARENT', 'STEP_PARENT'];

/**
 * Whether anyone hangs below this person.
 *
 * One level is enough to ask: if they have a child, that child may have their
 * own, so the whole branch is at stake. Walking further would not change the
 * answer.
 */
export function hasDescendants(tree: FamilyTree, memberId: string): boolean {
  return tree.relationships.some(
    (edge) => PARENTAL.includes(edge.type) && edge.fromMemberId === memberId,
  );
}

/**
 * Whether the viewer may change this person's name and gender, or take them
 * out of the family.
 *
 * The server's rule, mirrored so the sheet does not offer what would come
 * back 403 (`apps/api/src/family/family.service.ts`): a placeholder is the
 * family's to curate, an account holder is nobody's but their own. The server
 * stays the authority — this only decides what to draw (`CLAUDE.md` § 3).
 */
export function canManageMember(
  member: Pick<FamilyMemberSummary, 'userId'>,
  viewerUserId: string | null,
): boolean {
  return member.userId === null || (viewerUserId !== null && member.userId === viewerUserId);
}

export type RemovalBlock = 'notYours' | 'hasChildren' | null;

/**
 * Why this person cannot be taken out of the tree, or `null` if they can.
 *
 * Leaf nodes only. Removing someone with children below them would cut the
 * branch loose — the server deletes their relationships along with them, and
 * the grandchildren lose their only path to the rest of the family. What
 * should happen to relationships that routed through a removed person is an
 * open domain question (`docs/00-shared/domain-model.md` → Open Questions),
 * and a delete button is the wrong place to answer it by accident.
 */
export function removalBlock(
  tree: FamilyTree,
  member: Pick<FamilyMemberSummary, 'id' | 'userId'>,
  viewerUserId: string | null,
): RemovalBlock {
  if (!canManageMember(member, viewerUserId)) return 'notYours';
  if (hasDescendants(tree, member.id)) return 'hasChildren';
  return null;
}

/** The edge between the viewer and this member, if the two are directly related. */
export function edgeBetween(
  tree: FamilyTree,
  memberId: string,
  anchorMemberId: string,
): FamilyTree['relationships'][number] | null {
  return (
    tree.relationships.find(
      (edge) =>
        (edge.fromMemberId === memberId && edge.toMemberId === anchorMemberId) ||
        (edge.fromMemberId === anchorMemberId && edge.toMemberId === memberId),
    ) ?? null
  );
}

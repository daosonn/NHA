import type { FamilyTree, RelationshipType } from '../../lib/api';

/**
 * The word under a node, as a catalogue key.
 *
 * **Base relationships only** (decided 2026-08-18, `api-contract.md`). The
 * server stores edges — `PARENT`, `SPOUSE`, `SIBLING` — and the kinship word
 * a person actually uses is derived from those plus who is looking. Walking
 * the graph to reach "Grandmother" or "Cousin" is deliberately not done
 * here, so anyone more than one edge away simply has no word under their
 * name. That is the accepted cost of not inventing kinship logic before a
 * real family has used the tree.
 *
 * A key rather than a word, because `祖母` is not a translation of
 * "grandmother" that a string table can reach if the noun arrives already in
 * English (`architecture.md` § Language).
 */
const AS_PARENT: Record<RelationshipType, string | null> = {
  PARENT: 'family.relation.parent',
  ADOPTED_PARENT: 'family.relation.adoptedParent',
  STEP_PARENT: 'family.relation.stepParent',
  SPOUSE: null,
  SIBLING: null,
  OTHER: null,
};

const AS_CHILD: Record<RelationshipType, string | null> = {
  PARENT: 'family.relation.child',
  ADOPTED_PARENT: 'family.relation.adoptedChild',
  STEP_PARENT: 'family.relation.stepChild',
  SPOUSE: null,
  SIBLING: null,
  OTHER: null,
};

/** Edges where direction carries no meaning. */
const SYMMETRIC: Partial<Record<RelationshipType, string>> = {
  SPOUSE: 'family.relation.spouse',
  SIBLING: 'family.relation.sibling',
};

export function relationshipKey(
  tree: FamilyTree,
  viewerMemberId: string | null,
  subjectMemberId: string,
): string | null {
  if (viewerMemberId === null || viewerMemberId === subjectMemberId) return null;

  for (const edge of tree.relationships) {
    const symmetric = SYMMETRIC[edge.type];
    const connects =
      (edge.fromMemberId === viewerMemberId && edge.toMemberId === subjectMemberId) ||
      (edge.toMemberId === viewerMemberId && edge.fromMemberId === subjectMemberId);

    if (!connects) continue;

    if (symmetric !== undefined) return symmetric;

    // Directed edges read parent → child, so which end the subject sits on
    // decides the word.
    return edge.fromMemberId === subjectMemberId ? AS_PARENT[edge.type] : AS_CHILD[edge.type];
  }

  return null;
}

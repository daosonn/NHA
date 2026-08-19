import type { FamilyTree, RelationshipType } from '../../lib/api';
import type { FamilyTreeData, TreeMember } from '../../components/family/tree-layout';
import { relationshipKey } from './relationship-label';

/** Edge types that mean "from is a parent of to", however that parenthood came about. */
const PARENTAL: RelationshipType[] = ['PARENT', 'ADOPTED_PARENT', 'STEP_PARENT'];

/** Guards against a cycle in the data — a malformed tree must not hang the screen. */
const MAX_DEPTH = 32;

export type TreeFromGraphOptions = {
  /** The signed-in account, so exactly one node can be marked as the viewer. */
  viewerUserId: string | null;
  /** `(index) => 'GEN 1'` — the caller owns the copy, so this file stays i18n-free. */
  generationLabel: (index: number) => string;
  /** Turns a relationship key into a word. */
  translate: (key: string) => string;
  /**
   * Members holding a spot for somebody who has been invited and has not
   * arrived. Passed in rather than read off the member row, because the
   * tree payload has no such flag — a reserved spot is an ordinary
   * placeholder, and only the invitation list knows it is being kept warm.
   */
  pendingMemberIds?: ReadonlySet<string>;
};

/**
 * Flat graph in, laid-out tree out.
 *
 * The API returns members and edges and nothing else — the client owns
 * layout (`api-contract.md`). The tree component, however, takes an
 * *authored* structure: rows of people, partner links, and descents from a
 * couple down to a child. This is the piece in between.
 *
 * Generations come from distance to a root: someone with no parent in this
 * family sits in the top row, and everyone else sits one row below their
 * deepest parent. Partners are then pulled level with each other, because a
 * couple drawn across two rows reads as a parent and a child.
 *
 * `pending` nodes come from `pendingMemberIds`: the invitation endpoints
 * reserve a real placeholder member for each outstanding invite, so a spot
 * that is being held for somebody is an ordinary node the caller has
 * identified. `empty` is still never produced — an unreserved gap in a tree
 * is a drawing idea, not a row in the database.
 */
export function treeFromGraph(tree: FamilyTree, options: TreeFromGraphOptions): FamilyTreeData {
  const { viewerUserId, generationLabel, translate, pendingMemberIds } = options;

  const ids = new Set(tree.members.map((member) => member.id));

  // Only edges whose both ends are still in the family are usable: a member
  // can be removed while an edge that mentioned them lingers in a stale page.
  const edges = tree.relationships.filter(
    (edge) => ids.has(edge.fromMemberId) && ids.has(edge.toMemberId),
  );

  const parentsOf = new Map<string, string[]>();
  for (const edge of edges) {
    if (!PARENTAL.includes(edge.type)) continue;
    const list = parentsOf.get(edge.toMemberId) ?? [];
    list.push(edge.fromMemberId);
    parentsOf.set(edge.toMemberId, list);
  }

  const spousePairs = edges
    .filter((edge) => edge.type === 'SPOUSE')
    .map((edge): [string, string] => [edge.fromMemberId, edge.toMemberId]);

  const siblingPairs = edges
    .filter((edge) => edge.type === 'SIBLING')
    .map((edge): [string, string] => [edge.fromMemberId, edge.toMemberId]);

  const depths = computeDepths(
    tree.members.map((m) => m.id),
    parentsOf,
  );
  levelSideways(depths, spousePairs, siblingPairs);

  const viewerMemberId = tree.members.find((member) => member.userId === viewerUserId)?.id ?? null;

  // Rows, top-down, with only the depths that actually contain someone.
  const byDepth = new Map<number, TreeMember[]>();
  tree.members.forEach((member) => {
    const depth = depths.get(member.id) ?? 0;
    const row = byDepth.get(depth) ?? [];
    const key = relationshipKey(tree, viewerMemberId, member.id);

    row.push({
      id: member.id,
      name: member.displayName,
      // No word for anyone more than one edge away — see relationship-label.ts.
      role: key === null ? undefined : translate(key),
      tone: row.length % 2 === 0 ? 'light' : 'dark',
      state: pendingMemberIds?.has(member.id) === true ? 'pending' : 'active',
      isViewer: member.id === viewerMemberId ? true : undefined,
    });

    byDepth.set(depth, row);
  });

  const generations = [...byDepth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([depth, members], index) => ({
      id: `gen-${depth}`,
      label: generationLabel(index),
      members,
    }));

  return {
    name: tree.name,
    memberCount: tree.members.length,
    pendingCount: tree.members.filter((member) => pendingMemberIds?.has(member.id) === true).length,
    generations,
    couples: spousePairs.map((members) => ({ members })),
    descents: buildDescents(parentsOf, spousePairs),
  };
}

/** Distance from a root, memoised, with a depth cap in place of cycle detection. */
function computeDepths(ids: string[], parentsOf: Map<string, string[]>): Map<string, number> {
  const depths = new Map<string, number>();

  const depthOf = (id: string, seen: Set<string>): number => {
    const cached = depths.get(id);
    if (cached !== undefined) return cached;

    const parents = parentsOf.get(id) ?? [];
    // A cycle, or a chain deeper than any real family: stop rather than recurse.
    if (parents.length === 0 || seen.has(id) || seen.size > MAX_DEPTH) {
      depths.set(id, 0);
      return 0;
    }

    seen.add(id);
    const depth = 1 + Math.max(...parents.map((parent) => depthOf(parent, seen)));
    seen.delete(id);

    depths.set(id, depth);
    return depth;
  };

  ids.forEach((id) => depthOf(id, new Set()));
  return depths;
}

/**
 * Pulls everyone who belongs on the same row onto it.
 *
 * Depth only counts parent edges, so the two relationships that run
 * *sideways* both break it:
 *
 * - A partner who married in has no parent here, and would sit in the top row
 *   while their spouse sits three rows down.
 * - A sibling added without their own parent edges is, to the depth pass,
 *   parentless — so a brother lands one row *above* his sister, reading as
 *   her father. That is what the tree was drawing.
 *
 * Both are fixed the same way: pull the shallower end down to the deeper one.
 * Down, never up, so the pass can only ever push people away from the root
 * and is guaranteed to settle. One list rather than two passes, because
 * moving a sibling can unbalance a couple and vice versa.
 */
function levelSideways(
  depths: Map<string, number>,
  spousePairs: [string, string][],
  siblingPairs: [string, string][],
): void {
  const pairs = [...spousePairs, ...siblingPairs];

  for (let pass = 0; pass < pairs.length + 1; pass++) {
    let moved = false;

    for (const [a, b] of pairs) {
      const depthA = depths.get(a) ?? 0;
      const depthB = depths.get(b) ?? 0;
      if (depthA === depthB) continue;

      const deeper = Math.max(depthA, depthB);
      depths.set(a, deeper);
      depths.set(b, deeper);
      moved = true;
    }

    if (!moved) return;
  }
}

/**
 * Threads from parents down to a child.
 *
 * A thread leaves a *joint*: the midpoint between the two ids it is given.
 * That reads correctly only when those two are drawn as a couple, because
 * then the arc between them passes through the joint and the thread looks
 * like it grows out of the pair.
 *
 * Three cases:
 *
 * - **One known parent** — pass that id twice. The joint collapses onto the
 *   parent and the thread is a straight drop.
 * - **Two parents who are partners** — the joint sits on their arc.
 * - **Two parents with no spouse edge between them** — previously this hung
 *   the thread off the midpoint of two unrelated nodes, so it appeared to
 *   come out of empty space between them, or out of whichever node happened
 *   to be near it. Each parent now gets a thread of its own. Two lines is
 *   the honest drawing: the app knows both are parents and does not know
 *   they are a couple, and inventing the arc would be inventing a marriage.
 */
function buildDescents(
  parentsOf: Map<string, string[]>,
  spousePairs: [string, string][],
): { from: [string, string]; to: string }[] {
  const isCouple = (a: string, b: string) =>
    spousePairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  const descents: { from: [string, string]; to: string }[] = [];

  for (const [child, parents] of parentsOf) {
    if (parents.length === 0) continue;

    const couple = parents
      .flatMap((a, i) => parents.slice(i + 1).map((b): [string, string] => [a, b]))
      .find(([a, b]) => isCouple(a, b));

    if (couple !== undefined) {
      descents.push({ from: couple, to: child });
      continue;
    }

    for (const parent of parents) {
      descents.push({ from: [parent, parent], to: child });
    }
  }

  return descents;
}

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
 * What this cannot produce: `empty` and `pending` nodes. Those describe a
 * spot reserved for someone who has been invited, and the server has no
 * per-spot invite — `Family.inviteCode` is one code for the whole family.
 * The component still supports both states; nothing feeds them yet.
 */
export function treeFromGraph(tree: FamilyTree, options: TreeFromGraphOptions): FamilyTreeData {
  const { viewerUserId, generationLabel, translate } = options;

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

  const depths = computeDepths(
    tree.members.map((m) => m.id),
    parentsOf,
  );
  levelPartners(depths, spousePairs);

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
      state: 'active',
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
    // No per-spot invites on the server yet, so nothing is ever pending.
    pendingCount: 0,
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
 * Pulls each partner down to the deeper of the two.
 *
 * Someone who married into the family has no parent here, so they would
 * otherwise land in the top row while their spouse sits three rows down.
 * Repeated because moving one partner can unbalance another pair; bounded by
 * the number of pairs, since each pass can only ever move people downward.
 */
function levelPartners(depths: Map<string, number>, pairs: [string, string][]): void {
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
 * One thread per child, leaving its parents.
 *
 * Two parents who are partners give the thread a joint to leave from. A
 * single known parent passes the same id twice, which puts the joint on that
 * parent — a straight drop rather than a couple's arc.
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

    if (parents.length === 1) {
      descents.push({ from: [parents[0], parents[0]], to: child });
      continue;
    }

    // Prefer a pair the tree already draws an arc between, so the thread
    // leaves the joint rather than floating between two unrelated parents.
    const pair =
      parents
        .flatMap((a, i) => parents.slice(i + 1).map((b): [string, string] => [a, b]))
        .find(([a, b]) => isCouple(a, b)) ?? ([parents[0], parents[1]] as [string, string]);

    descents.push({ from: pair, to: child });
  }

  return descents;
}

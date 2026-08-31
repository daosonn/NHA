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
  /** Gutter label for the strip of members no edge mentions. */
  unplacedLabel: string;
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
  const { viewerUserId, generationLabel, unplacedLabel, translate, pendingMemberIds } = options;

  const ids = new Set(tree.members.map((member) => member.id));

  // Only edges whose both ends are still in the family are usable: a member
  // can be removed while an edge that mentioned them lingers in a stale page.
  const edges = tree.relationships.filter(
    (edge) => ids.has(edge.fromMemberId) && ids.has(edge.toMemberId),
  );

  /**
   * Members no edge mentions at all. Depth would put them in the top row
   * beside the grandparents, which reads as a claim about their place; they
   * go to a strip of their own instead (decided 2026-08-27) — but only when
   * the tree has edges to be apart FROM. A brand-new family of one is not
   * "unplaced", it is the whole tree.
   */
  const mentioned = new Set<string>();
  for (const edge of edges) {
    mentioned.add(edge.fromMemberId);
    mentioned.add(edge.toMemberId);
  }
  const isUnplaced = (memberId: string) => edges.length > 0 && !mentioned.has(memberId);

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

  /**
   * Two people who parent the same child are DRAWN as a couple — arc, joint,
   * one thread down — even when nobody recorded a SPOUSE edge between them
   * (owner's report 2026-08-28: adding a grandmother and grandfather through
   * the edit-mode slots gave each their own line stuck straight into the
   * child, "hai cái dính vào chứ không kết nối rồi sinh ra"; two
   * placeholders can never be given a spouse edge in the UI, so this was
   * every added-parents pair). Same rule as the partner auto-join over
   * children below: the DRAWING infers, the database still records only the
   * edges people actually created. Someone already partnered is skipped —
   * one person cannot be welded into two couple blocks.
   */
  const isPartnered = (id: string) => spousePairs.some(([a, b]) => a === id || b === id);
  for (const parents of parentsOf.values()) {
    if (parents.length !== 2) continue;
    const [a, b] = parents;
    if (a === b || isPartnered(a) || isPartnered(b)) continue;
    spousePairs.push([a, b]);
  }

  const siblingPairs = edges
    .filter((edge) => edge.type === 'SIBLING')
    .map((edge): [string, string] => [edge.fromMemberId, edge.toMemberId]);

  const depths = resolveDepths(
    tree.members.map((m) => m.id),
    parentsOf,
    spousePairs,
    siblingPairs,
  );

  const viewerMemberId = tree.members.find((member) => member.userId === viewerUserId)?.id ?? null;

  // Rows, top-down, with only the depths that actually contain someone.
  const byDepth = new Map<number, TreeMember[]>();
  const unplaced: TreeMember[] = [];
  tree.members.forEach((member) => {
    const depth = depths.get(member.id) ?? 0;
    const row = isUnplaced(member.id) ? unplaced : (byDepth.get(depth) ?? []);
    const key = relationshipKey(tree, viewerMemberId, member.id);

    row.push({
      id: member.id,
      name: member.displayName,
      // No word for anyone more than one edge away — see relationship-label.ts.
      role: key === null ? undefined : translate(key),
      // The server already falls back to the account's picture for a linked
      // member, so this is the same face they have everywhere else.
      avatarMediaId: member.avatarKey,
      tone: row.length % 2 === 0 ? 'light' : 'dark',
      state: pendingMemberIds?.has(member.id) === true ? 'pending' : 'active',
      isViewer: member.id === viewerMemberId ? true : undefined,
      avatarKey: member.avatarKey,
      birthDate: member.birthDate ?? null,
      gender: member.gender,
    });

    if (row !== unplaced) byDepth.set(depth, row);
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
    unplaced,
    unplacedLabel,
    couples: spousePairs.map((members) => ({ members })),
    siblings: siblingPairs,
    descents: buildDescents(parentsOf, spousePairs),
  };
}

/**
 * Everyone's generation, as the fixed point of three rules that only ever
 * pull people DOWN (so the loop must settle):
 *
 * 1. **A child sits strictly below every parent** — at least one row under
 *    the deepest of them.
 * 2. **A parent hangs one row above their shallowest child.** Without this a
 *    parent added to somebody rows deep (edit mode's "add mother") has no
 *    parents of their own, computes depth 0, and is drawn in the top row
 *    beside the great-grandparents with a thread spanning the gap.
 * 3. **Partners and siblings share a row** — the shallower is pulled level.
 *
 * These used to be two ordered passes (parent-distance, then a
 * spouse/sibling levelling), and that order was the bug found 2026-08-31:
 * levelling moved people, and nothing re-derived the depths that had been
 * computed FROM them — a niece drawn above the sister who mothers her, a
 * child of a levelled spouse left a row above both parents. Connections
 * were right; tiers were stale. A fixed point cannot go stale.
 *
 * Termination: depths only increase and are clamped to `MAX_DEPTH`, and the
 * pass cap is the Bellman–Ford bound (constraints propagate at least one
 * step per pass), so malformed data (a parental cycle) exhausts the cap and
 * draws SOMETHING rather than hanging the screen.
 */
function resolveDepths(
  ids: string[],
  parentsOf: Map<string, string[]>,
  spousePairs: [string, string][],
  siblingPairs: [string, string][],
): Map<string, number> {
  const depths = new Map<string, number>(ids.map((id) => [id, 0]));
  const pairs = [...spousePairs, ...siblingPairs];

  const childrenOf = new Map<string, string[]>();
  for (const [child, parents] of parentsOf) {
    for (const parent of parents) {
      childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), child]);
    }
  }

  const at = (id: string) => depths.get(id) ?? 0;
  const raise = (id: string, to: number): boolean => {
    const clamped = Math.min(to, MAX_DEPTH);
    if (at(id) >= clamped) return false;
    depths.set(id, clamped);
    return true;
  };

  for (let pass = 0; pass <= ids.length + 1; pass++) {
    let moved = false;

    for (const [child, parents] of parentsOf) {
      moved = raise(child, 1 + Math.max(...parents.map(at))) || moved;
    }
    for (const [parent, children] of childrenOf) {
      moved = raise(parent, Math.min(...children.map(at)) - 1) || moved;
    }
    for (const [a, b] of pairs) {
      const deeper = Math.max(at(a), at(b));
      moved = raise(a, deeper) || moved;
      moved = raise(b, deeper) || moved;
    }

    if (!moved) break;
  }

  return depths;
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
 * - **One known parent WITH a partner** — the child hangs from the couple's
 *   joint, partner included (Đạt, 2026-08-27: no distinction between "their"
 *   children and "our" children — a partner is auto-joined to their spouse's
 *   children in the DRAWING; the database still records only the edges
 *   people actually created).
 * - **One known parent, no partner** — pass that id twice. The joint
 *   collapses onto the parent and the thread is a straight drop.
 * - **Two parents who are partners** — the joint sits on their arc.
 * - **Two parents with no spouse edge between them** — each parent gets a
 *   thread of its own; hanging the thread off the midpoint of two unrelated
 *   nodes made it appear from empty space. Since 2026-08-28 this case is
 *   rare: co-parents of the same child are inferred into `spousePairs`
 *   upstream, so it remains only for a third parent or someone whose real
 *   partner is elsewhere in the tree.
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

    if (parents.length === 1) {
      const partnered = spousePairs.find(([x, y]) => x === parents[0] || y === parents[0]);
      descents.push({ from: partnered ?? [parents[0], parents[0]], to: child });
      continue;
    }

    for (const parent of parents) {
      descents.push({ from: [parent, parent], to: child });
    }
  }

  return descents;
}

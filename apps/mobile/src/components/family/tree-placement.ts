/**
 * Horizontal placement, the prototype's way (2026-08-31, replacing the
 * bounding-box block layout of 2026-08-27 — `family-tree-rendering.md`
 * records both and why the switch).
 *
 * `src/family-tree-canvas.html` does not lay the whole tree out from
 * structure; it gives each person a spot WHEN THEY ARE ADDED and then keeps
 * it: `findFreeX` scans outward from a suggested x until the row has room,
 * `findPairX` seats a completed parent-pair over their child, and after
 * every addition each row is shifted so its mean sits on the tree's centre
 * axis — which is what keeps the composition balanced without anybody
 * being re-arranged.
 *
 * The app cannot store an x (the server sends members and edges, nothing
 * else — `api-contract.md`), so this file REPLAYS that history instead: the
 * payload lists members in the order they joined (`data.order`), and walking
 * it through the same rules gives the same coordinates every time. Adding a
 * member appends to the order, so everyone already placed replays to the
 * spot they already had — the layout is stable by construction, exactly like
 * the prototype, at the cost the prototype also pays: a parent is centred
 * over their children only when the pair-seating rule fires, so a deep tree
 * settles organically rather than geometrically.
 */

import type { FamilyTreeData, TreeMember } from './tree-layout';

/**
 * Centre-to-centre inside a couple. The prototype seats pairs 258 apart with
 * 76px avatars; scaled to our 60px nodes that is ~204 — a long, readable arc
 * with the joint dot in the middle, not the tight 118 the block layout used.
 */
export const COUPLE_PITCH = 204;
/** `findFreeX` scans the row in steps of this (the prototype's 135).
 *  Exported so the edit-mode slots predict the same landing spot. */
export const FREE_STEP = 135;
/**
 * Two centres closer than this on one row count as a collision. The
 * prototype uses 110; ours is 120 because the name label under a node is
 * 104px wide and may not touch its neighbour.
 */
const MIN_CLEAR = 120;
/** Where a pair may sit relative to the suggested centre, tried in order. */
const PAIR_OFFSETS = [0, 200, -200, 400, -400, 600, -600];

type Placed = { id: string; x: number };

/**
 * Everyone's x, in axis-centred coordinates (each row's mean ≈ 0).
 * `layoutTree` shifts the whole map into world coordinates afterwards.
 * Members of the unplaced strip are not in the result — the strip spaces
 * itself.
 */
export function placeMembers(data: FamilyTreeData): Map<string, number> {
  const rowOf = new Map<string, number>();
  const memberOf = new Map<string, TreeMember>();
  data.generations.forEach((generation, row) => {
    for (const member of generation.members) {
      rowOf.set(member.id, row);
      memberOf.set(member.id, member);
    }
  });

  const partnersOf = new Map<string, string[]>();
  for (const {
    members: [a, b],
  } of data.couples) {
    partnersOf.set(a, [...(partnersOf.get(a) ?? []), b]);
    partnersOf.set(b, [...(partnersOf.get(b) ?? []), a]);
  }

  // Parenthood as DRAWN — descents already include inferred couples and the
  // partner auto-join, so the replay seats exactly what the threads connect.
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const {
    from: [a, b],
    to,
  } of data.descents) {
    for (const parent of a === b ? [a] : [a, b]) {
      const parents = parentsOf.get(to) ?? [];
      if (!parents.includes(parent)) parents.push(parent);
      parentsOf.set(to, parents);
      const children = childrenOf.get(parent) ?? [];
      if (!children.includes(to)) children.push(to);
      childrenOf.set(parent, children);
    }
  }

  const siblingOf = new Map<string, string[]>();
  for (const [a, b] of data.siblings) {
    siblingOf.set(a, [...(siblingOf.get(a) ?? []), b]);
    siblingOf.set(b, [...(siblingOf.get(b) ?? []), a]);
  }

  const xs = new Map<string, number>();

  const rowMates = (row: number, except: string[] = []): Placed[] =>
    [...xs.entries()]
      .filter(([id]) => rowOf.get(id) === row && !except.includes(id))
      .map(([id, x]) => ({ id, x }));

  /** Nearest free x on the row, scanning outward from the preferred spot. */
  const findFreeX = (row: number, preferred: number, except: string[] = []): number => {
    const others = rowMates(row, except);
    const fits = (x: number) => !others.some((other) => Math.abs(other.x - x) < MIN_CLEAR);
    for (const step of [0, 1, -1, 2, -2, 3, -3]) {
      const x = preferred + step * FREE_STEP;
      if (fits(x)) return x;
    }
    let x = preferred;
    for (let guard = 0; !fits(x) && guard < 40; guard++) x += FREE_STEP;
    return x;
  };

  /** A pair's two seats, centred on `centerX`, shifted whole if crowded. */
  const findPairX = (row: number, centerX: number, except: string[]): [number, number] => {
    const half = COUPLE_PITCH / 2;
    const others = rowMates(row, except);
    const fits = (lx: number, rx: number) =>
      !others.some((other) => other.x > lx - MIN_CLEAR && other.x < rx + MIN_CLEAR);
    for (const offset of PAIR_OFFSETS) {
      const lx = centerX + offset - half;
      const rx = centerX + offset + half;
      if (fits(lx, rx)) return [lx, rx];
    }
    const maxX = others.length > 0 ? Math.max(...others.map((other) => other.x)) : 0;
    return [maxX + MIN_CLEAR + 30, maxX + MIN_CLEAR + 30 + COUPLE_PITCH];
  };

  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

  /**
   * Siblings order oldest-left (Đạt, 2026-08-27) — kept here as a BIAS on the
   * suggestion, not a sort: someone younger than every placed sibling starts
   * looking right of them, someone older starts left, and `findFreeX` still
   * has the final word. Members without a date arrive to the right, after
   * everyone (arrival order).
   */
  const siblingBias = (id: string, joint: number, placedSiblings: Placed[]): number => {
    if (placedSiblings.length === 0) return joint;
    const birth = memberOf.get(id)?.birthDate ?? null;
    const dated = placedSiblings
      .map((sibling) => ({ ...sibling, birth: memberOf.get(sibling.id)?.birthDate ?? null }))
      .filter((sibling) => sibling.birth !== null);
    const rightmost = Math.max(...placedSiblings.map((sibling) => sibling.x)) + FREE_STEP;
    if (birth === null || dated.length === 0) return rightmost;
    if (dated.every((sibling) => (sibling.birth as string) <= birth)) return rightmost;
    if (dated.every((sibling) => (sibling.birth as string) >= birth)) {
      return Math.min(...placedSiblings.map((sibling) => sibling.x)) - FREE_STEP;
    }
    return joint;
  };

  for (const id of data.order) {
    const row = rowOf.get(id);
    if (row === undefined || xs.has(id)) continue; // the unplaced strip

    const partner = (partnersOf.get(id) ?? []).find(
      (candidate) => xs.has(candidate) && rowOf.get(candidate) === row,
    );
    const placedChildren = (childrenOf.get(id) ?? []).filter((child) => xs.has(child));
    const placedParents = (parentsOf.get(id) ?? []).filter((parent) => xs.has(parent));

    if (partner !== undefined && placedChildren.length > 0) {
      // A parent arriving to a partner who already stands over their child —
      // the prototype re-seats BOTH as a pair centred on the child
      // (mother left, father right when the genders say so).
      const center = mean(placedChildren.map((child) => xs.get(child) as number));
      const [lx, rx] = findPairX(row, center, [partner, id]);
      const gender = memberOf.get(id)?.gender;
      const meLeft =
        gender === 'FEMALE'
          ? true
          : gender === 'MALE'
            ? false
            : (xs.get(partner) as number) >= center;
      xs.set(id, meLeft ? lx : rx);
      xs.set(partner, meLeft ? rx : lx);
    } else if (partner !== undefined) {
      // Marrying in: beside them, on whichever side the row has room — the
      // prototype's `rightFree` check. Without it a sibling standing to the
      // right pushes the spouse PAST them, and the arc sweeps behind a face.
      const px = xs.get(partner) as number;
      const others = rowMates(row);
      const seatFits = (x: number) =>
        !others.some((other) => other.id !== partner && Math.abs(other.x - x) < MIN_CLEAR);
      const preferred = seatFits(px + COUPLE_PITCH)
        ? px + COUPLE_PITCH
        : seatFits(px - COUPLE_PITCH)
          ? px - COUPLE_PITCH
          : px + COUPLE_PITCH;
      xs.set(id, findFreeX(row, preferred));
    } else if (placedParents.length > 0) {
      // A child: under the parents' joint, nudged by the sibling rule.
      const joint = mean(placedParents.map((parent) => xs.get(parent) as number));
      const placedSiblings = [
        ...new Set(
          placedParents.flatMap((parent) => childrenOf.get(parent) ?? []).filter((c) => c !== id),
        ),
      ]
        .filter((sibling) => xs.has(sibling))
        .map((sibling) => ({ id: sibling, x: xs.get(sibling) as number }));
      xs.set(id, findFreeX(row, siblingBias(id, joint, placedSiblings)));
    } else if (placedChildren.length > 0) {
      // A lone parent added after their child (edit mode's first parent
      // slot): above the children, not on the axis.
      xs.set(id, findFreeX(row, mean(placedChildren.map((child) => xs.get(child) as number))));
    } else {
      // A sibling edge is all that ties some people in — stand beside them.
      const sibling = (siblingOf.get(id) ?? []).find(
        (candidate) => xs.has(candidate) && rowOf.get(candidate) === row,
      );
      const preferred = sibling === undefined ? 0 : (xs.get(sibling) as number) + FREE_STEP;
      xs.set(id, findFreeX(row, preferred));
    }

    // The prototype's centre-axis step, after every addition: shift each row
    // so its mean sits on 0. This is the whole balancing act — nobody is
    // re-arranged, rows just glide as a group.
    const byRow = new Map<number, string[]>();
    for (const placedId of xs.keys()) {
      const placedRow = rowOf.get(placedId) as number;
      byRow.set(placedRow, [...(byRow.get(placedRow) ?? []), placedId]);
    }
    for (const ids of byRow.values()) {
      const offset = -mean(ids.map((placedId) => xs.get(placedId) as number));
      if (Math.abs(offset) < 0.5) continue;
      for (const placedId of ids) xs.set(placedId, (xs.get(placedId) as number) + offset);
    }
  }

  return xs;
}

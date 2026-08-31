/**
 * Turns the family graph into coordinates.
 *
 * The mockup pins every node to a pixel, but those numbers are derived, not
 * intended: 112 and 241 are simply the two thirds of a 353px canvas. Positions
 * are computed from the measured width instead, so the tree holds together
 * from an iPhone Mini to a Pro Max.
 *
 * Rows come from generations; x comes from `tree-placement.ts`, which replays
 * the prototype's add-one-at-a-time placement over the member order. This
 * file keeps only pixels: rows, normalising, the unplaced strip, and the SVG
 * path helpers.
 */

import { COUPLE_PITCH, FREE_STEP, placeMembers } from './tree-placement';

export { COUPLE_PITCH, FREE_STEP };

export type NodeState = 'active' | 'pending' | 'empty';

export type TreeMember = {
  id: string;
  /** Empty spots have no name until someone is invited into them. */
  name?: string;
  role?: string;
  /** Their photograph, as a `Media` id. Absent draws initials. */
  avatarMediaId?: string | null;
  tone?: 'light' | 'dark';
  state: NodeState;
  /** The signed-in user. Exactly one node per tree. */
  isViewer?: boolean;
  /** Ảnh thật của người này (id Media) — không có thì node vẽ chữ cái đầu. */
  avatarKey?: string | null;
  /** ISO date (YYYY-MM-DD) — siblings order oldest-left by it. */
  birthDate?: string | null;
  /** Giới tính — chế độ chỉnh sửa cần nó để biết còn thiếu mẹ hay bố. */
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null;
};

export type TreeGeneration = {
  id: string;
  label: string;
  members: TreeMember[];
};

export type FamilyTreeData = {
  name: string;
  memberCount: number;
  pendingCount: number;
  generations: TreeGeneration[];
  /** Members no edge mentions — drawn in a strip of their own, not GEN 1. */
  unplaced: TreeMember[];
  /** Gutter label for that strip. */
  unplacedLabel: string;
  /** Partner links, drawn as a shallow arc between two nodes. */
  couples: { members: [string, string] }[];
  /** Sibling links — no stroke of their own, but they anchor placement. */
  siblings: [string, string][];
  /** A couple's joint down to a child. */
  descents: { from: [string, string]; to: string }[];
  /**
   * Every member id in the order they joined the family — the placement
   * replay walks it so each person keeps the spot they were given the day
   * they were added (`tree-placement.ts`).
   */
  order: string[];
};

/** Standard node diameter. The viewer is larger so it reads first. */
export const NODE_SIZE = 60;
export const VIEWER_NODE_SIZE = 68;

const FIRST_ROW_Y = 64;
/**
 * Row pitch, the prototype's 270 scaled to our 60px nodes (2026-08-31; the
 * wide couples want the taller descent — 172 read squat under a 204 pair).
 * Exported for the edit-mode slots, which sit one row above/below a node.
 */
export const ROW_GAP = 212;
/** Space under each node for the name and relationship labels. */
const LABEL_BLOCK = 52;

export type PositionedNode = TreeMember & {
  x: number;
  y: number;
  size: number;
};

export type PositionedRow = {
  id: string;
  label: string;
  y: number;
};

export type TreeLayout = {
  nodes: Map<string, PositionedNode>;
  rows: PositionedRow[];
  height: number;
  /** World width. At least the viewport; grows when a row genuinely needs it. */
  width: number;
};

/** First and last node centre to the world's edge. */
const EDGE_MARGIN = 96;

/**
 * Prototype-replay layout (2026-08-31, replacing the family-unit block
 * layout of 2026-08-27 — `family-tree-rendering.md` records both):
 *
 * 1. Rows are generations, top-down — unchanged.
 * 2. x replays the prototype's placement per member in join order
 *    (`tree-placement.ts`): a spot is found once and kept, pairs seat over
 *    their child, and every row balances around a centre axis.
 * 3. A crowded row still widens the WORLD, not the spacing: the placement is
 *    axis-centred, this function measures its extent and gives the world
 *    that much room. The canvas pans; the layout does not squeeze.
 */
export function layoutTree(
  data: FamilyTreeData,
  viewportWidth: number,
  /**
   * Extra room above the first row. Edit mode passes it so the "add mother /
   * father" slots of a TOP-ROW person have somewhere to be — without it they
   * clamp down right onto the selected face (owner's report 2026-08-28).
   */
  topGutter = 0,
): TreeLayout {
  const nodes = new Map<string, PositionedNode>();
  const rows: PositionedRow[] = [];
  const firstRowY = FIRST_ROW_Y + topGutter;

  const xs = placeMembers(data);

  // ---- normalise into world coordinates --------------------------------
  let minX = Infinity;
  let maxX = -Infinity;
  for (const x of xs.values()) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
  }
  if (xs.size === 0) {
    minX = 0;
    maxX = 0;
  }

  const spanWidth = maxX - minX + EDGE_MARGIN * 2;
  const width = Math.max(viewportWidth, spanWidth);
  // A tree narrower than the viewport sits centred, like it always has.
  const shift = EDGE_MARGIN - minX + (width - spanWidth) / 2;

  data.generations.forEach((generation, row) => {
    const y = firstRowY + row * ROW_GAP;
    rows.push({ id: generation.id, label: generation.label, y });
    for (const member of generation.members) {
      const x = xs.get(member.id);
      if (x === undefined) continue;
      nodes.set(member.id, {
        ...member,
        x: x + shift,
        y,
        size: member.isViewer === true ? VIEWER_NODE_SIZE : NODE_SIZE,
      });
    }
  });

  // ---- the unplaced strip ------------------------------------------------
  if (data.unplaced.length > 0) {
    const y = firstRowY + rows.length * ROW_GAP;
    rows.push({ id: 'unplaced', label: data.unplacedLabel, y });
    data.unplaced.forEach((member, index) => {
      nodes.set(member.id, {
        ...member,
        x: (width * (index + 1)) / (data.unplaced.length + 1),
        y,
        size: member.isViewer === true ? VIEWER_NODE_SIZE : NODE_SIZE,
      });
    });
  }

  const lastRow = rows[rows.length - 1];
  const height = lastRow === undefined ? 0 : lastRow.y + NODE_SIZE / 2 + LABEL_BLOCK;

  return { nodes, rows, height, width };
}

/** Where a couple's two threads meet, and the descent leaves from. */
export function coupleJoint(a: PositionedNode, b: PositionedNode) {
  return { x: (a.x + b.x) / 2, y: a.y + 10 };
}

/**
 * A shallow arc between partners. It leaves the edge of each avatar rather
 * than its centre so the stroke never runs underneath a face. The sag is the
 * prototype's 18, scaled to our nodes — with the 204 pitch the arc finally
 * has the length to read as the prototype's swoop.
 */
export function couplePath(a: PositionedNode, b: PositionedNode): string {
  const left = a.x < b.x ? a : b;
  const right = a.x < b.x ? b : a;
  const gap = 3;
  const startX = left.x + left.size / 2 + gap;
  const endX = right.x - right.size / 2 - gap;
  const midX = (a.x + b.x) / 2;

  return `M${startX} ${left.y} Q${midX} ${left.y + 16} ${endX} ${right.y}`;
}

/**
 * One continuous bezier from the couple's joint into the top edge of the
 * child — never a right-angle branch line (design-system.md). Both control
 * points sit near the TOP (the prototype's 72/92 of a 252 drop): the thread
 * falls from the joint and flares out late toward the child.
 */
export function descentPath(joint: { x: number; y: number }, child: PositionedNode): string {
  const startY = joint.y + 1;
  const endY = child.y - child.size / 2 - 4;
  const span = endY - startY;

  return `M${joint.x} ${startY} C${joint.x} ${startY + span * 0.3} ${child.x} ${startY + span * 0.38} ${child.x} ${endY}`;
}

/**
 * A lone parent's thread — the prototype's other descent: an S-curve whose
 * controls sit symmetrically near each end, so a drop to an offset child
 * flows instead of kinking. Starts at the parent's centre (hidden behind
 * their avatar, like the prototype's) and enters the child's top edge.
 */
export function singleDescentPath(parent: PositionedNode, child: PositionedNode): string {
  const startY = parent.y;
  const endY = child.y - child.size / 2 - 4;
  const bend = (endY - startY) * 0.32;

  return `M${parent.x} ${startY} C${parent.x} ${startY + bend} ${child.x} ${endY - bend} ${child.x} ${endY}`;
}

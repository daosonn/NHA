/**
 * Turns the family graph into coordinates.
 *
 * The mockup pins every node to a pixel, but those numbers are derived, not
 * intended: 112 and 241 are simply the two thirds of a 353px canvas. Positions
 * are computed from the measured width instead, so the tree holds together
 * from an iPhone Mini to a Pro Max.
 *
 * Layout is still *authored* — generations and couples come from the data. A
 * computed layout (`d3-hierarchy`, per architecture.md) only becomes worth its
 * weight once trees are deep and irregular enough to be hand-placed badly.
 */

export type NodeState = 'active' | 'pending' | 'empty';

export type TreeMember = {
  id: string;
  /** Empty spots have no name until someone is invited into them. */
  name?: string;
  role?: string;
  tone?: 'light' | 'dark';
  state: NodeState;
  /** The signed-in user. Exactly one node per tree. */
  isViewer?: boolean;
  /** Ảnh thật của người này (id Media) — không có thì node vẽ chữ cái đầu. */
  avatarKey?: string | null;
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
  /** Partner links, drawn as a shallow arc between two nodes. */
  couples: { members: [string, string] }[];
  /** A couple's joint down to a child. */
  descents: { from: [string, string]; to: string }[];
};

/** Standard node diameter. The viewer is larger so it reads first. */
export const NODE_SIZE = 60;
export const VIEWER_NODE_SIZE = 68;

const FIRST_ROW_Y = 56;
const ROW_GAP = 150;
/** Space under each node for the name and relationship labels. */
const LABEL_BLOCK = 44;

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
};

export function layoutTree(data: FamilyTreeData, width: number): TreeLayout {
  const nodes = new Map<string, PositionedNode>();
  const rows: PositionedRow[] = [];

  data.generations.forEach((generation, row) => {
    const y = FIRST_ROW_Y + row * ROW_GAP;
    rows.push({ id: generation.id, label: generation.label, y });

    const count = generation.members.length;
    generation.members.forEach((member, index) => {
      nodes.set(member.id, {
        ...member,
        // Evenly spaced, which lands within a few px of the mockup for the
        // two-per-generation case it happens to draw.
        x: (width * (index + 1)) / (count + 1),
        y,
        size: member.isViewer === true ? VIEWER_NODE_SIZE : NODE_SIZE,
      });
    });
  });

  const lastRow = rows[rows.length - 1];
  const height = lastRow === undefined ? 0 : lastRow.y + NODE_SIZE / 2 + LABEL_BLOCK;

  return { nodes, rows, height };
}

/** Where a couple's two threads meet, and the descent leaves from. */
export function coupleJoint(a: PositionedNode, b: PositionedNode) {
  return { x: (a.x + b.x) / 2, y: a.y + 6 };
}

/**
 * A shallow arc between partners. It leaves the edge of each avatar rather
 * than its centre so the stroke never runs underneath a face.
 */
export function couplePath(a: PositionedNode, b: PositionedNode): string {
  const left = a.x < b.x ? a : b;
  const right = a.x < b.x ? b : a;
  const gap = 3;
  const startX = left.x + left.size / 2 + gap;
  const endX = right.x - right.size / 2 - gap;
  const midX = (a.x + b.x) / 2;

  return `M${startX} ${left.y} Q${midX} ${left.y + 12} ${endX} ${right.y}`;
}

/**
 * One continuous bezier from the couple's joint into the top edge of the
 * child — never a right-angle branch line (design-system.md).
 */
export function descentPath(joint: { x: number; y: number }, child: PositionedNode): string {
  const startY = joint.y + 1;
  const endY = child.y - child.size / 2 - 4;
  const span = endY - startY;

  return `M${joint.x} ${startY} C${joint.x} ${startY + span * 0.4} ${child.x} ${startY + span * 0.42} ${child.x} ${endY}`;
}

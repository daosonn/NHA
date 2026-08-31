/**
 * Turns the family graph into coordinates.
 *
 * The mockup pins every node to a pixel, but those numbers are derived, not
 * intended: 112 and 241 are simply the two thirds of a 353px canvas. Positions
 * are computed from the measured width instead, so the tree holds together
 * from an iPhone Mini to a Pro Max.
 *
 * Rows come from generations; x comes from the family-unit blocks built in
 * `tree-blocks.ts` (weld couples, hang children, order by age). This file
 * keeps only pixels: extents, placement, normalising, the unplaced strip,
 * and the SVG path helpers.
 */

import {
  assignOwners,
  buildBlocks,
  interleaveAdopted,
  orderChildren,
  type Block,
} from './tree-blocks';

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

/**
 * Centre-to-centre inside a couple. The prototype seats pairs 258 apart with
 * 76px avatars; scaled to our 60px nodes that is ~204 — a long, readable arc
 * with the joint dot in the middle (2026-08-31, was 118).
 */
export const COUPLE_PITCH = 204;
/** Minimum centre-to-centre across neighbouring blocks — room for two labels. */
const BLOCK_PITCH = 152;
/** First and last node centre to the world's edge. */
const EDGE_MARGIN = 96;

/**
 * Family-unit layout: blocks, not individuals — "gom thành cụm rồi sắp xếp"
 * (Đạt). Built 2026-08-27, swapped for the prototype's replay placement on
 * the morning of 2026-08-31, and restored the same day: the replay had no
 * notion of a cluster, so children of different couples interleaved along a
 * row and their threads crossed. `family-tree-rendering.md` records all
 * three schemes.
 *
 * 1. Partners are welded into blocks, so a couple can never be split by
 *    whoever happened to sit between them in the payload.
 * 2. A child's block hangs off its parents' block, and parents are centred
 *    over the spread of their children — descents drop straight instead of
 *    sweeping, and branches can never cross.
 * 3. Every block reserves its subtree's width, so neighbouring branches can
 *    never overlap, and a crowded row widens the WORLD rather than
 *    compressing nodes into each other — the canvas pans, the layout does
 *    not squeeze.
 *
 * It is deliberately a bounding-box tidy-up, not Reingold–Tilford: family
 * graphs are not strict trees (two roots marry; a child's parents may not
 * be a couple), and the contour bookkeeping only earns its complexity once
 * bounding boxes visibly waste space. `architecture.md` keeps d3-hierarchy
 * as the eventual step.
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

  // ---- arrangement: weld, hang, order, balance — see tree-blocks.ts ----
  const { blocks, blockOf } = buildBlocks(data);
  assignOwners(data, blocks, blockOf);
  orderChildren(data, blocks);
  interleaveAdopted(blocks);

  // ---- widths, bottom-up: a subtree reserves its bounding box ----------
  const extents = new Map<Block, number>();
  const extentOf = (block: Block): number => {
    const cached = extents.get(block);
    if (cached !== undefined) return cached;
    const own = (block.ids.length - 1) * COUPLE_PITCH;
    const children = block.children.reduce(
      (sum, child, index) => sum + extentOf(child) + (index > 0 ? BLOCK_PITCH : 0),
      0,
    );
    const extent = Math.max(own, block.children.length > 0 ? children : 0);
    extents.set(block, extent);
    return extent;
  };

  /** Everything `place` has seated this run — the main tree's bounds. */
  const placedBlocks = new Set<Block>();

  // ---- placement, top-down ----------------------------------------------
  const place = (block: Block, left: number): void => {
    placedBlocks.add(block);
    if (block.children.length > 0) {
      // Children first, side by side; parents then centre over the
      // thread-connected CORE (the interleave rule keeps it in the middle),
      // so the descent drops straight down. Adopted-only children fall back
      // to the whole spread — there is no thread to line up with.
      //
      // When the PARENTS are the wider side (a 204 couple over one or two
      // children), the children start centred inside the parents' span —
      // without this they hugged the left edge and the joint hung 26px off
      // the descent's landing (visible from 2026-08-31's wide couples;
      // latent since 2026-08-27 with a single child under a 118 pair).
      const childrenSpan = block.children.reduce(
        (sum, child, index) => sum + extentOf(child) + (index > 0 ? BLOCK_PITCH : 0),
        0,
      );
      let cursor = left + Math.max(0, (extentOf(block) - childrenSpan) / 2);
      for (const child of block.children) {
        place(child, cursor);
        cursor += extentOf(child) + BLOCK_PITCH;
      }
      const core = block.children.filter((child) => child.ownedVia === 'parent');
      const span = core.length > 0 ? core : block.children;
      const first = span[0];
      const last = span[span.length - 1];
      const mid = (first.firstX + last.lastX) / 2;
      const own = (block.ids.length - 1) * COUPLE_PITCH;
      // Clamped inside the subtree's reserved box: an off-centre core must
      // not push the parents into the neighbouring branch's space.
      block.firstX = Math.min(left + extentOf(block) - own, Math.max(left, mid - own / 2));
    } else {
      block.firstX = left;
    }
    block.lastX = block.firstX + (block.ids.length - 1) * COUPLE_PITCH;
  };

  // ---- in-law roots dock over their child, not beside the tree ---------
  // A couple hangs under ONE side's parents (`assignOwners`); the other
  // side's parents own nothing, so they used to be placed as a stray root
  // at the tree's right edge with a long slanted thread back to their
  // child. They now dock above the partner they parent (owner's call
  // 2026-08-31: "phải căn chỉnh sao cho 2 bên đối xứng" — both families
  // symmetric around the couple).
  const dockings: { root: Block; couple: Block; childId: string }[] = [];
  const docked = new Set<Block>();
  for (const block of blocks) {
    if (block.owner !== null || block.children.length > 0) continue;
    const descent = data.descents.find(({ from, to }) => {
      if (!from.some((id) => block.ids.includes(id))) return false;
      const child = blockOf.get(to);
      return (
        child !== undefined &&
        child !== block &&
        child.owner !== null &&
        child.owner !== block &&
        child.owner.row === block.row &&
        child.row === block.row + 1
      );
    });
    if (descent === undefined) continue;
    dockings.push({ root: block, couple: blockOf.get(descent.to) as Block, childId: descent.to });
    docked.add(block);
  }

  // ---- a partner's whole branch stays on their seat's side ---------------
  // (owner, 2026-08-31: "nhánh của bên trái thì sẽ phải nằm bên trái, nhánh
  // của bên phải thì sẽ nằm bên phải"). An in-law family too big to dock —
  // they own a subtree, the spouse's siblings live in it — used to be
  // appended as a stray root at the right edge whatever side their
  // child-in-law sat on, its thread slanting across the spine. Such roots
  // now STACK ADJACENT to the main tree on the side their couple leans
  // toward, and the couple's seats are turned so the linked partner faces
  // their own family.
  const sided: { root: Block; couple: Block; childId: string }[] = [];
  const sidedSet = new Set<Block>();
  for (const block of blocks) {
    if (block.owner !== null || docked.has(block)) continue;
    const descent = data.descents.find(({ from, to }) => {
      if (!from.some((id) => block.ids.includes(id))) return false;
      const child = blockOf.get(to);
      // `child.owner !== block` keeps a SPINE root out: it too has descents
      // into an owned couple — the couple it owns itself.
      return (
        child !== undefined && child !== block && child.owner !== null && child.owner !== block
      );
    });
    if (descent === undefined) continue;
    sided.push({ root: block, couple: blockOf.get(descent.to) as Block, childId: descent.to });
  }
  // A branch whose couple hangs inside ANOTHER side branch has no fixed
  // ground to stack against — those keep the plain stray-root treatment.
  const topRootOf = (block: Block): Block => {
    let cursor = block;
    while (cursor.owner !== null) cursor = cursor.owner;
    return cursor;
  };
  const anchored = sided.filter(({ couple }) => {
    const top = topRootOf(couple);
    return !docked.has(top) && !sided.some((other) => other.root === top);
  });
  for (const { root } of anchored) sidedSet.add(root);

  /** In-law roots the untangler has told to seat on the couple's other side. */
  const flipped = new Set<Block>();
  /** Side branches the untangler has told to stack on the other side. */
  const sideFlipped = new Set<Block>();

  /**
   * The whole placement, re-runnable: roots side by side (the main tree
   * first, then any stray ownerless branch, each keeping its bounding box),
   * then the side branches stacked against the main tree, then the in-law
   * blocks seated around their couple. The untangler below re-runs this
   * after every adjustment it tries.
   */
  const placeAll = () => {
    placedBlocks.clear();
    let cursor = 0;
    for (const block of blocks) {
      if (block.owner !== null || docked.has(block) || sidedSet.has(block)) continue;
      place(block, cursor);
      cursor += extentOf(block) + BLOCK_PITCH;
    }

    // ---- side branches: pick the side, turn the seats, stack outward ----
    let mainMin = Infinity;
    let mainMax = -Infinity;
    for (const block of placedBlocks) {
      mainMin = Math.min(mainMin, block.firstX);
      mainMax = Math.max(mainMax, block.lastX);
    }
    if (placedBlocks.size === 0) {
      mainMin = 0;
      mainMax = 0;
    }
    const treeMid = (mainMin + mainMax) / 2;
    const plans = anchored.map((entry) => {
      const coupleMid = (entry.couple.firstX + entry.couple.lastX) / 2;
      let side: 'left' | 'right' = coupleMid < treeMid - 1 ? 'left' : 'right';
      if (sideFlipped.has(entry.root)) side = side === 'left' ? 'right' : 'left';
      return { ...entry, side };
    });
    for (const { couple, childId, side } of plans) {
      // The linked partner takes the seat facing their family, so the
      // thread stays outside everybody instead of crossing their spouse.
      if (couple.ids.length !== 2) continue;
      const atLeft = couple.ids.indexOf(childId) === 0;
      if ((side === 'left') !== atLeft) couple.ids.reverse();
    }
    const seatXOf = (plan: (typeof plans)[number]) =>
      plan.couple.firstX + plan.couple.ids.indexOf(plan.childId) * COUPLE_PITCH;
    let cursorLeft = mainMin;
    for (const plan of plans
      .filter((plan) => plan.side === 'left')
      .sort((a, b) => seatXOf(b) - seatXOf(a))) {
      const left = cursorLeft - BLOCK_PITCH - extentOf(plan.root);
      place(plan.root, left);
      cursorLeft = left;
    }
    let cursorRight = mainMax;
    for (const plan of plans
      .filter((plan) => plan.side === 'right')
      .sort((a, b) => seatXOf(a) - seatXOf(b))) {
      place(plan.root, cursorRight + BLOCK_PITCH);
      cursorRight += BLOCK_PITCH + extentOf(plan.root);
    }

    const pending = new Set(dockings.map(({ root }) => root));
    for (const { root, couple, childId } of dockings) {
      const own = (root.ids.length - 1) * COUPLE_PITCH;
      const owner = couple.owner as Block;
      const coupleMid = (couple.firstX + couple.lastX) / 2;
      const childX = couple.firstX + couple.ids.indexOf(childId) * COUPLE_PITCH;
      const naturalRight = childX >= coupleMid;
      const rootRight = flipped.has(root) ? !naturalRight : naturalRight;

      const ownerIsLoneCouple =
        owner.owner === null && owner.children.length === 1 && owner.children[0] === couple;
      if (ownerIsLoneCouple) {
        // The symmetric H: both parent blocks side by side, centred over the
        // couple, each above their own child — descents mirror each other.
        const ownerOwn = (owner.ids.length - 1) * COUPLE_PITCH;
        const left = coupleMid - (ownerOwn + BLOCK_PITCH + own) / 2;
        owner.firstX = rootRight ? left : left + own + BLOCK_PITCH;
        root.firstX = rootRight ? left + ownerOwn + BLOCK_PITCH : left;
        owner.lastX = owner.firstX + ownerOwn;
        root.lastX = root.firstX + own;
      } else {
        // The owner side carries a wider subtree (siblings, grandparents):
        // best effort — straight above their own child (mirrored about the
        // couple when flipped), stepped outward until the row has room.
        const mates = blocks.filter(
          (other) => other !== root && other.row === root.row && !pending.has(other),
        );
        let firstX = (flipped.has(root) ? 2 * coupleMid - childX : childX) - own / 2;
        const overlaps = (fx: number) =>
          mates.some(
            (other) => fx - BLOCK_PITCH < other.lastX && fx + own + BLOCK_PITCH > other.firstX,
          );
        const step = (rootRight ? 1 : -1) * BLOCK_PITCH;
        for (let guard = 0; overlaps(firstX) && guard < 40; guard++) firstX += step;
        root.firstX = firstX;
        root.lastX = firstX + own;
      }
      pending.delete(root);
    }
  };
  placeAll();

  // ---- no two threads may cross (owner, 2026-08-31) ----------------------
  // "luôn luôn không có đường cắt nhau… nếu phát hiện cắt nhau thì tự điều
  // chỉnh". The block structure already prevents most crossings; what
  // remains (a child whose parents live in different blocks, a docked
  // in-law squeezed past a sibling) is DETECTED on straight-line proxies of
  // the descents and fixed by swapping the two subtrees at their point of
  // divergence — or flipping a docked in-law to the couple's other side. An
  // adjustment is kept only when the total number of crossings drops, so
  // the pass cannot trade one crossing for two and always terminates. A
  // genuinely non-planar family graph keeps its crossing — no flat drawing
  // of it exists. Runs inside layoutTree, so adding OR removing a member
  // re-establishes the invariant on the next layout.
  type ThreadSegment = {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    parent: Block;
    child: Block;
  };
  const rowYOf = (row: number) => firstRowY + row * ROW_GAP;
  const threadSegments = (): ThreadSegment[] => {
    const segments: ThreadSegment[] = [];
    for (const {
      from: [a, b],
      to,
    } of data.descents) {
      const parent = blockOf.get(a);
      const partner = blockOf.get(b);
      const child = blockOf.get(to);
      if (parent === undefined || partner === undefined || child === undefined) continue;
      const ax = parent.firstX + parent.ids.indexOf(a) * COUPLE_PITCH;
      const bx = partner.firstX + partner.ids.indexOf(b) * COUPLE_PITCH;
      const cx = child.firstX + child.ids.indexOf(to) * COUPLE_PITCH;
      segments.push({
        x1: (ax + bx) / 2,
        y1: rowYOf(parent.row),
        x2: cx,
        y2: rowYOf(child.row),
        parent,
        child,
      });
    }
    return segments;
  };
  const orient = (ox: number, oy: number, ax: number, ay: number, bx: number, by: number) =>
    (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
  /** Properly intersecting pairs — shared endpoints (one joint fanning out
   *  to several children, two threads into one child) do not count. */
  const crossings = (): [ThreadSegment, ThreadSegment][] => {
    const segments = threadSegments();
    const pairs: [ThreadSegment, ThreadSegment][] = [];
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const s = segments[i];
        const t = segments[j];
        const d1 = orient(s.x1, s.y1, s.x2, s.y2, t.x1, t.y1);
        const d2 = orient(s.x1, s.y1, s.x2, s.y2, t.x2, t.y2);
        const d3 = orient(t.x1, t.y1, t.x2, t.y2, s.x1, s.y1);
        const d4 = orient(t.x1, t.y1, t.x2, t.y2, s.x2, s.y2);
        if (d1 * d2 < 0 && d3 * d4 < 0) pairs.push([s, t]);
      }
    }
    return pairs;
  };
  /** Where two blocks' ancestries part ways — the swappable pair. */
  const divergingAt = (
    a: Block,
    b: Block,
  ): { common: Block; first: Block; second: Block } | null => {
    const chainOf = (block: Block): Block[] => {
      const list = [block];
      for (let cursor = block; cursor.owner !== null; cursor = cursor.owner)
        list.push(cursor.owner);
      return list;
    };
    const chainA = chainOf(a);
    const chainB = chainOf(b);
    const inB = new Set(chainB);
    const at = chainA.findIndex((block) => inB.has(block));
    if (at <= 0) return null; // no common owner, or one contains the other
    const common = chainA[at];
    const second = chainB[chainB.indexOf(common) - 1];
    if (second === undefined) return null;
    return { common, first: chainA[at - 1], second };
  };

  const tried = new Set<string>();
  let tangled = crossings();
  for (let guard = 0; guard < 20 && tangled.length > 0; guard++) {
    let acted = false;
    for (const [s, t] of tangled) {
      const swap = divergingAt(s.child, t.child);
      if (swap !== null) {
        const key = `swap:${[swap.first.anchorId, swap.second.anchorId].sort().join('|')}`;
        const children = swap.common.children;
        const i = children.indexOf(swap.first);
        const j = children.indexOf(swap.second);
        if (!tried.has(key) && i >= 0 && j >= 0) {
          tried.add(key);
          [children[i], children[j]] = [children[j], children[i]];
          placeAll();
          const after = crossings();
          if (after.length < tangled.length) {
            tangled = after;
          } else {
            [children[i], children[j]] = [children[j], children[i]];
            placeAll();
          }
          acted = true;
          break;
        }
      }
      const dockedParent = [s.parent, t.parent].find((block) => docked.has(block));
      if (dockedParent !== undefined) {
        const key = `flip:${dockedParent.anchorId}`;
        if (!tried.has(key)) {
          tried.add(key);
          flipped.add(dockedParent);
          placeAll();
          const after = crossings();
          if (after.length < tangled.length) {
            tangled = after;
          } else {
            flipped.delete(dockedParent);
            placeAll();
          }
          acted = true;
          break;
        }
      }
      const sidedTop = [s.parent, t.parent, s.child, t.child]
        .map(topRootOf)
        .find((block) => sidedSet.has(block));
      if (sidedTop !== undefined) {
        const key = `side:${sidedTop.anchorId}`;
        if (!tried.has(key)) {
          tried.add(key);
          sideFlipped.add(sidedTop);
          placeAll();
          const after = crossings();
          if (after.length < tangled.length) {
            tangled = after;
          } else {
            sideFlipped.delete(sidedTop);
            placeAll();
          }
          acted = true;
          break;
        }
      }
    }
    if (!acted) break;
  }

  // ---- normalise into world coordinates --------------------------------
  let minX = Infinity;
  let maxX = -Infinity;
  for (const block of blocks) {
    minX = Math.min(minX, block.firstX);
    maxX = Math.max(maxX, block.lastX);
  }
  if (blocks.length === 0) {
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
      const block = blockOf.get(member.id);
      if (block === undefined) continue;
      const index = block.ids.indexOf(member.id);
      nodes.set(member.id, {
        ...member,
        x: block.firstX + index * COUPLE_PITCH + shift,
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

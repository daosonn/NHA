/**
 * The empty spots edit mode offers around a selected person.
 *
 * Per the owner's prototype (`src/family-tree-canvas.html`, Đạt 2026-08-28):
 * selecting a node in edit mode shows dashed circles for whatever is still
 * missing — mother / father when the drawn parents leave room, a child
 * always, a spouse while they are single — and each slot's dashed preview
 * traces the EXACT thread that will exist once the person is added, so the
 * picker never promises a shape the tree will not draw.
 *
 * "Parents" here means parents *as drawn*: descents include a partner
 * auto-joined to their spouse's children (tree-from-graph.ts), and a slot
 * must not offer to add a father on top of a man already drawn in that place.
 */

import {
  COUPLE_PITCH,
  NODE_SIZE,
  ROW_GAP,
  coupleJoint,
  couplePath,
  descentPath,
  type FamilyTreeData,
  type PositionedNode,
  type TreeLayout,
} from './tree-layout';

export type SlotKind = 'mother' | 'father' | 'child' | 'spouse';

export type TreeSlot = {
  kind: SlotKind;
  /** World coordinates of the dashed circle's centre. */
  x: number;
  y: number;
  /** Dashed preview threads, in the same path language the real ones use. */
  paths: string[];
};

/** Horizontal offset of the two parent slots when no parent is drawn yet. */
const PARENT_SPREAD = 80;
/** A slot may not rise above the canvas — clamp like the prototype's `max(60, y)`. */
const MIN_Y = 40;
/** Two centres closer than this on a row count as "that spot is taken". */
const CLEARANCE = 110;

/** Just enough of a node for the path helpers, which read x/y/size only. */
function ghostAt(x: number, y: number): PositionedNode {
  return { id: 'slot', state: 'empty', x, y, size: NODE_SIZE };
}

/** Nearest free x on a row, scanning outward from the preferred spot. */
function findFreeX(layout: TreeLayout, y: number, preferred: number): number {
  const row = [...layout.nodes.values()].filter((node) => Math.abs(node.y - y) < 1);
  const candidates = [0, 1, -1, 2, -2, 3, -3].map((step) => preferred + step * COUPLE_PITCH);
  for (const x of candidates) {
    if (!row.some((node) => Math.abs(node.x - x) < CLEARANCE)) return x;
  }
  return preferred;
}

export function slotsFor(data: FamilyTreeData, layout: TreeLayout, selectedId: string): TreeSlot[] {
  const sel = layout.nodes.get(selectedId);
  if (sel === undefined) return [];

  // Parents as drawn: every id a descent into this node leaves from.
  const parentIds = new Set<string>();
  for (const descent of data.descents) {
    if (descent.to !== selectedId) continue;
    for (const id of descent.from) parentIds.add(id);
  }
  const parents = [...parentIds]
    .map((id) => layout.nodes.get(id))
    .filter((node): node is PositionedNode => node !== undefined);

  const partnerId = data.couples
    .find(({ members }) => members.includes(selectedId))
    ?.members.find((id) => id !== selectedId);
  const partner = partnerId === undefined ? undefined : layout.nodes.get(partnerId);

  const slots: TreeSlot[] = [];

  // ---- mother / father -----------------------------------------------
  if (parents.length === 0) {
    const y = Math.max(MIN_Y, sel.y - ROW_GAP);
    for (const kind of ['mother', 'father'] as const) {
      const x = sel.x + (kind === 'mother' ? -PARENT_SPREAD : PARENT_SPREAD);
      // A lone parent's thread is a straight drop from their own chin.
      slots.push({
        kind,
        x,
        y,
        paths: [descentPath(coupleJoint(ghostAt(x, y), ghostAt(x, y)), sel)],
      });
    }
  } else if (parents.length === 1) {
    const existing = parents[0];
    // The one still missing; an unknown gender leaves "mother" as the offer.
    const kind: SlotKind = existing.gender === 'FEMALE' ? 'father' : 'mother';
    // Beside the drawn parent, on the side that keeps the pair over the child.
    const x = existing.x <= sel.x ? existing.x + COUPLE_PITCH : existing.x - COUPLE_PITCH;
    const ghost = ghostAt(x, existing.y);
    slots.push({
      kind,
      x,
      y: existing.y,
      // Preview the finished shape: the couple's arc plus the descent that
      // will re-hang from their joint once both parents exist.
      paths: [couplePath(existing, ghost), descentPath(coupleJoint(existing, ghost), sel)],
    });
  }

  // ---- child (always) --------------------------------------------------
  {
    const jointX = partner === undefined ? sel.x : (sel.x + partner.x) / 2;
    const y = sel.y + ROW_GAP;
    const x = findFreeX(layout, y, jointX);
    const ghost = ghostAt(x, y);
    slots.push({
      kind: 'child',
      x,
      y,
      paths: [
        partner === undefined
          ? descentPath(coupleJoint(sel, sel), ghost)
          : descentPath(coupleJoint(sel, partner), ghost),
      ],
    });
  }

  // ---- spouse (while single) -------------------------------------------
  if (partner === undefined) {
    const rightTaken = [...layout.nodes.values()].some(
      (node) =>
        Math.abs(node.y - sel.y) < 1 &&
        node.x > sel.x &&
        node.x - sel.x < COUPLE_PITCH + CLEARANCE / 2,
    );
    const x = rightTaken ? sel.x - COUPLE_PITCH : sel.x + COUPLE_PITCH;
    slots.push({
      kind: 'spouse',
      x,
      y: sel.y,
      paths: [couplePath(sel, ghostAt(x, sel.y))],
    });
  }

  return slots;
}

import type { FamilyTreeData } from './tree-layout';

/**
 * The ARRANGEMENT layer of the tree: who stands with whom, who hangs under
 * whom, and in what order — no pixels. `tree-layout.ts` turns the block tree
 * this file builds into coordinates; `tree-from-graph.ts` builds the
 * semantic input both work from.
 *
 * Organised as one exported function per rule, so a new rule is a new
 * function slotted into `layoutTree`'s pipeline rather than a bigger loop:
 *
 * - `buildBlocks`    — the WELDING rule: what must stay side by side.
 * - `assignOwners`   — the HANGING rules: whose branch a block belongs to.
 * - `orderChildren`  — the ORDERING rule: how siblings line up.
 */
export type Block = {
  ids: string[];
  row: number;
  children: Block[];
  owner: Block | null;
  /** How this block came to hang where it does — see `assignOwners`. */
  ownedVia: 'parent' | 'sibling' | null;
  /**
   * The member whose relationships anchored this block to its owner — the
   * born-into-the-family one, not the partner who married in. Ordering
   * rules read this person's facts (birth date), never the whole block's.
   */
  anchorId: string;
  /** Centre x of the first/last member; written by the layout, not here. */
  firstX: number;
  lastX: number;
};

/**
 * Weld partners into blocks; everyone else stands alone. A remarriage
 * (A–B and A–C on one row) chains into a single block with the shared
 * person between the arcs, rather than two blocks fighting over A.
 */
export function buildBlocks(data: FamilyTreeData): {
  blocks: Block[];
  blockOf: Map<string, Block>;
} {
  const partnersOf = new Map<string, string[]>();
  for (const {
    members: [a, b],
  } of data.couples) {
    partnersOf.set(a, [...(partnersOf.get(a) ?? []), b]);
    partnersOf.set(b, [...(partnersOf.get(b) ?? []), a]);
  }

  const blockOf = new Map<string, Block>();
  const blocks: Block[] = [];

  data.generations.forEach((generation, row) => {
    const inRow = new Set(generation.members.map((member) => member.id));
    for (const member of generation.members) {
      if (blockOf.has(member.id)) continue;
      const ids = [member.id];
      for (let cursor = 0; cursor < ids.length; cursor++) {
        for (const partner of partnersOf.get(ids[cursor]) ?? []) {
          if (inRow.has(partner) && !ids.includes(partner) && !blockOf.has(partner)) {
            ids.push(partner);
          }
        }
      }
      const block: Block = {
        ids,
        row,
        children: [],
        owner: null,
        ownedVia: null,
        anchorId: member.id,
        firstX: 0,
        lastX: 0,
      };
      blocks.push(block);
      for (const id of ids) blockOf.set(id, block);
    }
  });

  return { blocks, blockOf };
}

/**
 * Decide whose branch each block hangs from. Two rules, in order:
 *
 * 1. **Parentage** — the block of the first member with known parents hangs
 *    off that parent's block, and only when the parent's row is above
 *    (malformed data cannot recurse).
 * 2. **Sibling adoption** — a parentless block whose sibling has a place
 *    adopts the sibling's owner and stands right beside them: siblings
 *    share parents even when the data has not said whose, and without this
 *    a sibling-only member trails off to the side as a stray root and the
 *    composition leans instead of centring (Đạt, 2026-08-27).
 */
export function assignOwners(
  data: FamilyTreeData,
  blocks: Block[],
  blockOf: Map<string, Block>,
): void {
  const parentsOf = new Map<string, string[]>();
  for (const {
    from: [a, b],
    to,
  } of data.descents) {
    const list = parentsOf.get(to) ?? [];
    for (const parent of [a, b]) if (!list.includes(parent)) list.push(parent);
    parentsOf.set(to, list);
  }

  for (const block of blocks) {
    const anchorId = block.ids.find((id) => (parentsOf.get(id) ?? []).length > 0);
    if (anchorId === undefined) continue;
    const parentId = (parentsOf.get(anchorId) ?? []).find((id) => blockOf.has(id));
    if (parentId === undefined) continue;
    const parent = blockOf.get(parentId);
    if (parent === undefined || parent.row >= block.row || parent === block) continue;
    parent.children.push(block);
    block.owner = parent;
    block.ownedVia = 'parent';
    block.anchorId = anchorId;
  }

  const siblingOf = new Map<string, string[]>();
  for (const [a, b] of data.siblings) {
    siblingOf.set(a, [...(siblingOf.get(a) ?? []), b]);
    siblingOf.set(b, [...(siblingOf.get(b) ?? []), a]);
  }
  for (let adopted = true; adopted;) {
    adopted = false;
    for (const block of blocks) {
      if (block.owner !== null) continue;
      for (const id of block.ids) {
        const anchor = (siblingOf.get(id) ?? [])
          .map((siblingId) => blockOf.get(siblingId))
          .find(
            (sibling): sibling is Block =>
              sibling !== undefined &&
              sibling !== block &&
              sibling.owner !== null &&
              sibling.owner.row < block.row,
          );
        if (anchor === undefined || anchor.owner === null) continue;
        // Beside the sibling, not at the end of the owner's children — kept
        // adjacent so brothers and sisters read as one run.
        const at = anchor.owner.children.indexOf(anchor);
        anchor.owner.children.splice(at + 1, 0, block);
        block.owner = anchor.owner;
        block.ownedVia = 'sibling';
        block.anchorId = id;
        adopted = true;
        break;
      }
    }
  }
}

/** Sorts after every real date; ISO dates compare correctly as strings. */
const NO_BIRTH_DATE = '9999-12-31';

/**
 * Siblings line up oldest to youngest, left to right (Đạt, 2026-08-27).
 *
 * The key is the ANCHOR's birth date — the child of the couple above, never
 * the partner who married in — so a young spouse does not drag an eldest
 * sibling to the right. Members without a date keep their arrival order,
 * after everyone dated (the sort is stable).
 */
export function orderChildren(data: FamilyTreeData, blocks: Block[]): void {
  const birthOf = new Map<string, string>();
  for (const generation of data.generations) {
    for (const member of generation.members) {
      if (member.birthDate != null) birthOf.set(member.id, member.birthDate);
    }
  }

  for (const block of blocks) {
    if (block.children.length < 2) continue;
    block.children.sort((a, b) => {
      const byAge = (birthOf.get(a.anchorId) ?? NO_BIRTH_DATE).localeCompare(
        birthOf.get(b.anchorId) ?? NO_BIRTH_DATE,
      );
      return byAge;
    });
  }
}

/**
 * The BALANCE rule (Đạt, 2026-08-27: "vẽ kiểu xen kẽ và căn giữa").
 *
 * Sibling-adopted blocks have no thread of their own, and piled to one side
 * they drag the parents' centring away from the children the threads DO
 * reach — grandparents ended up askew of the parents below them. They now
 * alternate LEFT and RIGHT around the thread-connected core (oldest goes
 * left, per the ordering rule), so the core — and the parents centred over
 * it in `tree-layout.ts` — stays in the middle of the spread.
 */
export function interleaveAdopted(blocks: Block[]): void {
  for (const block of blocks) {
    const core = block.children.filter((child) => child.ownedVia === 'parent');
    const adopted = block.children.filter((child) => child.ownedVia !== 'parent');
    if (core.length === 0 || adopted.length < 1) continue;

    const left: Block[] = [];
    const right: Block[] = [];
    adopted.forEach((child, index) => {
      (index % 2 === 0 ? left : right).push(child);
    });
    block.children = [...left, ...core, ...right];
  }
}

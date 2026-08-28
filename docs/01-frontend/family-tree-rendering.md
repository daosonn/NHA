# Family Tree Rendering

How the tree screen turns the API's flat graph into the picture on the
canvas, and what that means when people get added. The visual language
(node anatomy, colours, the pending lifecycle) lives in
`design-system.md` → Family tree; this document is about **structure,
placement, and the algorithm** — the things you need when deciding where
a new person should land.

Written 2026-08-27 (Đạt + Claude), when the interaction layer was rebuilt
to the HTML prototype and the layout's limits became the next question.

## The pipeline, end to end

```
GET /families/:id/tree            members[] + relationships[] — no layout
        |
        v
treeFromGraph()                   src/features/family/tree-from-graph.ts
        |                         semantic structure: generations, couples,
        |                         descents; viewer + pending flags
        v
layoutTree()                      src/components/family/tree-layout.ts
        |                         coordinates: x/y per node, row y's, height
        v
render                            src/components/family/family-tree.tsx
  ├─ TreeThreads                  one SVG layer under everything: couple
  │                               arcs, joints, descent beziers
  ├─ GenerationLabel[]            "GEN n" down the left gutter
  └─ TreeNode[]                   pressable avatars, drawn over the threads
        |
        v
interaction                       world plane translated then scaled about
                                  its top-left corner; pan/pinch/double-tap/
                                  wheel — spec'd by the HTML prototype
                                  (src/Family Tree Canvas.dc.html)
```

The server sends **members and edges and nothing else** — the client owns
layout (`api-contract.md`). Between the wire and the pixels there are two
distinct transforms, and they answer different questions:

- `treeFromGraph` answers _"who sits in which row, who is a couple, which
  pair does a child hang from"_ — pure graph work, no pixels.
- `layoutTree` answers _"where exactly"_ — pure pixels, no graph
  knowledge. It never looks at an edge.

That split is deliberate: placement bugs are either "wrong row" (graph
side) or "wrong spot in the row" (layout side), and the two files never
share blame.

## Vertical placement: generations from parent-distance

`computeDepths` gives every member a depth:

- **No parent edges in this family → depth 0** (top row).
- Otherwise **depth = 1 + max(depth of each parent)** — a child sits one
  row below their _deepest_ parent.
- `PARENT`, `ADOPTED_PARENT`, `STEP_PARENT` all count as parental
  (`PARENTAL` in tree-from-graph.ts); `SPOUSE`/`SIBLING`/`OTHER` do not.
- A cycle in the data (malformed edges) is cut off by `MAX_DEPTH = 32`
  instead of hanging the screen.

Depth alone gets two things wrong, and `levelSideways` fixes both by
**pulling the shallower person DOWN to the deeper one** (never up, so the
pass always settles):

- A spouse who married in has no parents here → depth 0 → would sit in
  the top row while their partner sits three rows down.
- A sibling added without their own parent edges is parentless → would
  sit one row _above_ their sister, reading as her father.

Rows are then whatever depths actually contain someone, sorted, and
labelled `GEN 1..n` **by index, not by depth** — so gaps in depth do not
produce empty rows or skipped labels.

## Horizontal placement: family-unit blocks (2026-08-27)

Even spacing by API order was replaced the day this document was written —
it split couples, swept arcs behind strangers' faces, and let crowded rows
overlap (the original sins are recorded in this file's git history).
`layoutTree` now arranges **blocks**, not individuals:

1. **Weld partners into blocks.** A couple is one block and can never be
   separated by payload order; a remarriage (A–B, A–C on one row) chains
   into a single block with the shared person between the arcs.
2. **Hang child blocks off their parents' block** (ownership goes to the
   first parent with a known block, and only when that parent's row is
   above — malformed data cannot recurse). A block with no parents but a
   **sibling that has a place adopts that sibling's owner** and is placed
   right beside them — siblings share parents even when the data has not
   said whose, and without this a sibling-only member trailed off to the
   side as a stray root and the whole composition leaned instead of
   centring.
3. **Reserve bounding boxes bottom-up**: a block's extent is
   `max(own span, Σ children extents + gaps)`, so neighbouring branches
   cannot overlap by construction.
4. **Place top-down**: children side by side, parents centred over their
   children's actual spread — descents drop straight instead of sweeping.
5. **A crowded row widens the WORLD, not the spacing.** The canvas is a
   pan/zoom surface; `layoutTree` returns its own `width`, the world can
   exceed the viewport, and the view opens (and recenters) at a **fit
   scale** so nothing is cropped. Trees narrower than the viewport sit
   centred, as before.

Pitches: 104px centre-to-centre inside a couple, 128px minimum across
blocks, 72px edge margins (`tree-layout.ts`). **Siblings order oldest to
youngest, left to right** (2026-08-27): the tree payload now carries each
member's Life Profile `birthDate`, and the sort key is the block's ANCHOR
— the child of the couple above, never the partner who married in — so a
young spouse cannot drag an eldest sibling rightward. Members without a
date keep arrival order, after everyone dated.

The arrangement rules live in their own module, **`tree-blocks.ts`**, one
exported function per rule so a new rule is a new function in the
pipeline, not a bigger loop: `buildBlocks` (welding), `assignOwners`
(hanging: parentage, then sibling adoption), `orderChildren` (age),
`interleaveAdopted` (balance). `tree-layout.ts` keeps only pixels:
extents, placement, normalising, the unplaced strip, and the SVG path
helpers.

**Balance** (2026-08-27, "vẽ kiểu xen kẽ và căn giữa"): sibling-adopted
blocks have no thread, and piled to one side they dragged the parents'
centring away from the children the threads DO reach — grandparents sat
askew of the parents below. Adopted blocks now alternate left and right
around the thread-connected core, and the parents centre over the CORE
(clamped inside the subtree's reserved box), so the grandparents stand
straight above the parents and the descent drops vertically.

**A partner is auto-joined to their spouse's children** (2026-08-27, "no
'their children' vs 'our children'"): a child with ONE known parent whose
parent has a partner hangs from the couple's joint, partner included —
a drawing rule in `buildDescents`; the database still records only the
edges people actually created.

It is deliberately a bounding-box tidy-up, not Reingold–Tilford: family
graphs are not strict trees (two roots marry; a child's parents may not be
a couple), and contour bookkeeping only earns its complexity once bounding
boxes visibly waste space. `architecture.md` keeps d3-hierarchy as the
eventual step if that day comes.

## Threads

All strokes live in one SVG layer under the nodes (`tree-threads.tsx`):

- **Couple arc** — a shallow quadratic from avatar edge to avatar edge
  (never under a face), with a small coral **joint** dot at the midpoint,
  6px below the row line.
- **Descent** — one cubic bezier from the joint down into the top edge of
  the child's avatar. Dashed while the child is `pending`.
- **Two parents who are not a couple** get **two separate straight
  drops**, one from each parent — the app knows both are parents and does
  not know they are a couple, and drawing the arc would invent a marriage.
- **One known parent** — the joint collapses onto that parent (the pair is
  the same id twice) and the thread is a straight drop.

## What happens when a new person is added, today

The invite flow (`POST /families/:id/invitations`) creates the placeholder
member **and** its edge to the anchor (the selected node in edit mode, the
inviter otherwise) in one transaction, the tree refetches, and the passes
above run again. Concretely:

| New person is a…                                              | Where they land                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Child of an existing couple                                   | One row below their deepest parent, centred with their siblings under the parents' joint.                                                                                                                                                                                                                                                                                                                       |
| Spouse                                                        | Depth 0 at first, then `levelSideways` pulls them down level with their partner; the couple welds into one block, arc between them.                                                                                                                                                                                                                                                                             |
| Sibling (invited)                                             | The server now **mirrors the inviter's plain `PARENT` edges onto the new sibling** in the same transaction (invitation.service.ts, 2026-08-27) — siblings share parents, so the new node hangs from the same joint instead of floating. Adopted/step edges are NOT mirrored: they are the inviter's own story. A sibling added by some future path without parent edges still floats — honest, but unconnected. |
| Parent of an existing top-row person                          | New depth-0 root; **everyone below shifts down a row and every generation relabels** (GEN 1 becomes GEN 2's people). Correct, but visually a big jump for one addition.                                                                                                                                                                                                                                         |
| Member with **no edges at all** (`POST /members` placeholder) | The **"unplaced" strip** — a labelled row of its own under the last generation (`family.unplacedRow`), not GEN 1 beside the grandparents. Only exists while the tree has edges to be apart from: a brand-new family of one is the whole tree, not unplaced.                                                                                                                                                     |

The kinship words on invites (`features/family/kinship.ts`) always measure
from the **anchor** of the invite — the selected node in edit mode, the
inviter otherwise — and the server stores only the edge; where someone
_lands_ is entirely the client passes above, never something the API
promised.

## Edit mode: adding by tapping the spot (2026-08-28)

Per the owner's prototype `src/family-tree-canvas.html` (Đạt): typing a
relationship was the error-prone part of adding, so the add button became
an **edit toggle** (pencil ↔ check, `EditToggleButton`) and adding happens
by tapping WHERE the person belongs.

- In edit mode a tap **selects** a node (deep-coral ring) instead of
  opening its profile; long-press still manages it.
- `tree-slots.ts` computes the dashed slots around the selection: mother /
  father while the **drawn** parents leave room (descents, so a partner
  auto-joined over a child counts as occupying that spot; a lone parent's
  gender decides which slot is still open), a child always, a spouse while
  single. Each slot carries dashed preview paths that trace the exact
  thread the tree will draw once the person exists — built with the same
  `couplePath`/`descentPath` the real threads use.
- Tapping a slot opens the **same invite sheet**, but the kinship picker is
  gone: the slot already decided the edge (`slotEdge` in `kinship.ts` —
  type, direction, gender for the parent slots, display `kinshipKey`), and
  the spot card says the placement in words instead. The request carries
  `anchorMemberId` (the selected node) so the edge hangs off the person the
  slots were drawn around — the first flow where the anchor is not the
  inviter.
- Arrival animation: a node whose id was not in the previous payload
  springs in (overshooting scale + fade, `TreeNode`'s `appear`), slots pop
  the same way. Sliding existing nodes to their new positions and morphing
  thread paths (the prototype's CSS `transition: d`) is **not** built —
  react-native-svg has no path-d tweening, so a relayout still snaps.

The generic form (with the kinship picker, anchored to the viewer) remains
only behind the empty-tree state, where there is nothing to select yet.

## The interaction layer (for completeness)

The canvas is a world plane transformed as `translate(tx, ty) scale(s)`
about its **top-left corner**, so `screen = tx + world · s` — the
invariant that makes focal-point zoom solvable. Pinch zooms about the
fingers, wheel zooms at the cursor, double-tap toggles fit ↔ 1.7×, the
± buttons ease toward the canvas centre, range 0.35–2.4×, elastic
overscroll on both pan and scale with `withDecay` flings. The feel and
numbers come from the HTML prototype `src/Family Tree Canvas.dc.html`;
the three web-only traps (NativeWind refs, gesture-handler swallowing
wheel after a pan, node presses firing after a drag) are documented in
`project-status.md` (2026-08-27) and as comments in `family-tree.tsx`.

One layout-relevant note: the world IS wider than the viewport whenever a
row needs the room — `layoutTree` returns the world's width, `boundsFor`
clamps against it, and the view opens and recenters at the fit scale
(`fitScale = min(1, viewport / world)`), so a wide tree greets you whole,
not cropped.

## When the tree grows — what remains on the table

Done 2026-08-27 (this branch): family-unit blocks, children centred under
parents, min spacing with a wider world + fit-to-view, the unplaced strip,
and sibling parent-edge inference. Still open, roughly by cost:

1. **Computed layout — `d3-hierarchy` or hand-rolled Reingold–Tilford**
   (expensive): contour-based x placement wastes less width than bounding
   boxes on staggered trees. Family graphs are not strict trees, so naive
   tidy-tree needs adaptation. Only worth it when bounding boxes visibly
   waste space.
2. ~~**Explicit spot picking** ("add here" on the canvas)~~ — built
   2026-08-28 as edit mode's slots (section above). What remains of it is
   motion: sliding existing nodes and morphing threads when the layout
   re-arranges around an addition.

Known gaps, accepted for now: the everyone-shifts-down parent insert (a
new grandparent relabels every generation); a child whose two parents sit
in DIFFERENT blocks hangs under the first parent and its second thread may
cross; a sibling created by a non-invite path without parent edges still
floats unconnected.

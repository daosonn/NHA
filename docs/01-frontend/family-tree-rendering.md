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

## Vertical placement: generations as a fixed point

`resolveDepths` (tree-from-graph.ts) settles every member's row as the
fixed point of three rules that only ever pull people DOWN — monotone, so
the loop must converge:

1. **A child sits strictly below every parent** (at least one row under
   the deepest). `PARENT`, `ADOPTED_PARENT`, `STEP_PARENT` all count as
   parental; `SPOUSE`/`SIBLING`/`OTHER` do not.
2. **A parent hangs one row above their shallowest child** — the rule that
   places a parent added AFTER the child (edit mode's "add mother" to
   somebody rows deep) next to their child instead of at depth 0 in the
   top row.
3. **Partners and siblings share a row** — the shallower pulled level.

It replaced two ordered passes (parent-distance, then a spouse/sibling
levelling) on 2026-08-31, after the ordering was caught drawing
connections right but tiers wrong: levelling moved people and nothing
re-derived the depths computed FROM them — a niece drawn a row above the
sister who mothers her, a child of a levelled spouse floating above both
parents, an added mother beside the great-grandparents. A fixed point
cannot go stale. Malformed data (a parental cycle) exhausts the
Bellman–Ford pass cap and the `MAX_DEPTH = 32` clamp instead of hanging
the screen.

Rows are then whatever depths actually contain someone, sorted, and
labelled `GEN 1..n` **by index, not by depth** — so gaps in depth do not
produce empty rows or skipped labels.

## Horizontal placement: the prototype's replay (2026-08-31)

This is the third scheme, and each replaced the previous for a recorded
reason. Even spacing by API order split couples and let rows overlap
(2026-08-27, this file's git history). The **family-unit block layout**
that replaced it (welding couples into blocks, hanging child blocks off
parents, bounding boxes bottom-up, parents centred over children —
`tree-blocks.ts`, now deleted, readable at commit `2ccbe13`) guaranteed
straight descents and no overlaps, but recomputed the whole arrangement
from structure on every payload: one addition could re-seat many people,
and the composition never matched the owner's prototype, which nobody
ever re-arranges. Replaced 2026-08-31 (owner's call) with what the
prototype actually does:

The prototype gives each person a spot **when they are added** and then
keeps it: `findFreeX` scans outward from a suggested x until the row has
room, `findPairX` seats a completed parent-pair over their child (mother
left when the genders say so), and after every addition each row shifts so
its mean sits on the tree's centre axis — balance without anybody moving
relative to their neighbours. The app cannot store an x (the server sends
members and edges only), so **`tree-placement.ts` replays that history**:
the payload lists members in join order (`data.order`, from the server's
`joinedAt asc`), and walking them through the same rules yields the same
coordinates every time. Adding a member appends to the order, so everyone
already placed replays to the spot they already had — **the layout is
stable by construction**.

Suggestions per case, in the order tried: a parent arriving to a partner
who already stands over their child re-seats BOTH as a pair centred on the
child; a spouse sits one couple-pitch beside their partner on whichever
side is free (the prototype's `rightFree` check — without it a sibling to
the right pushed the spouse past them and the arc swept behind a face); a
child starts under their parents' joint, nudged by the sibling rule; a
sibling-only member starts beside their placed sibling; a root starts on
the axis.

Pitches: **204px** centre-to-centre inside a couple (the prototype's 258
scaled to our 60px nodes — the long arc with the joint dot is the look),
135px `findFreeX` scan step, 120px minimum clearance (the prototype's 110,
raised because our name labels are 104px wide), **212px between rows** (the
prototype's 270, scaled), 96px edge margins. The pan may rest 72px past
"content flush" on every side (`PAN_MARGIN`, `family-tree.tsx`,
2026-08-28). A crowded row still **widens the WORLD, not the spacing** —
the placement is axis-centred, `layoutTree` measures its extent, and the
view opens at fit scale.

**Siblings order oldest to youngest, left to right** (2026-08-27) survives
as a _bias_, not a sort: someone younger than every placed sibling starts
looking for a spot to their right, someone older to their left, and
`findFreeX` has the final word. Members without a date arrive to the
right, after everyone (arrival order).

**A partner is auto-joined to their spouse's children** (2026-08-27, "no
'their children' vs 'our children'"): a child with ONE known parent whose
parent has a partner hangs from the couple's joint, partner included —
a drawing rule in `buildDescents`; the database still records only the
edges people actually created.

The recorded trade (both directions honest): the block layout guaranteed a
parent geometrically centred over the spread of their children forever;
the replay guarantees it at the moment the pair is seated and lets the
composition settle organically afterwards, exactly like the prototype. In
exchange, adding a person moves nobody else sideways — rows only glide as
a group when their mean shifts — which is what makes the tree feel like a
place rather than a diagram that keeps redrawing itself.

## Threads

All strokes live in one SVG layer under the nodes (`tree-threads.tsx`):

- **Couple arc** — a shallow quadratic from avatar edge to avatar edge
  (never under a face), with a small coral **joint** dot at the midpoint,
  10px below the row line (numbers rescaled 2026-08-31 to the prototype's
  proportions: sag 16, dot r4, and the 204px pitch gives the arc its
  length).
- **Descent** — one cubic bezier from the joint down into the top edge of
  the child's avatar, both control points near the top so the thread falls
  and flares late (the prototype's shape). Dashed while the child is
  `pending`.
- **A single known parent's thread** is the prototype's other curve: an
  S-bend from the parent's own chin with controls near each end
  (`singleDescentPath`), so a drop to an offset child flows instead of
  kinking.
- **Two co-parents of the same child are DRAWN as a couple** even with no
  SPOUSE edge between them (2026-08-28, owner's report: an added
  grandmother + grandfather each got their own line stuck straight into the
  child instead of "connect, then descend" — and two placeholders can never
  be given a spouse edge in the UI, so that was every added-parents pair).
  Same contract as the partner auto-join: the drawing infers, the database
  records only edges people created. Skipped when either co-parent already
  has a real partner — nobody is welded into two couples — and then:
- **Two parents who are not (and cannot be inferred as) a couple** get
  **two separate single-parent threads**, one from each parent.
- **One known parent** — the descent carries the same id twice and the
  drawing switches to the single-parent S-curve above.

One consequence named on purpose: an inferred couple hides both people's
"add partner" slot in edit mode, since the slots read the same drawn
couples list — consistent with what the canvas shows.

## The opening draw-on: built and removed the same day (2026-08-31)

The prototype opens by _drawing itself_ — generations popping in 1.05s
apart, arcs and descents drawing between them in equal 550ms strokes
(dash-to-measured-length, since react-native-svg has no `pathLength`). It
was built faithfully and **removed the same day at the owner's call**:
on a real tree the choreography costs three-plus seconds before the last
row exists, every open, and the tree is a navigation surface — "thấy mất
thời gian quá". The implementation is in this branch's history if a
one-time variant (first launch, empty-to-first-member) is ever wanted.
What the canvas keeps: new nodes spring in, new threads fade in on the
relayout slide's tail, and edit-mode slots pop — shortened the same day
(0.75→1, damping 17/420, `tree-slot-marker.tsx`) because four slots doing
the full new-person bounce at once read as fussy.

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
  single. While editing, `layoutTree` is given a 96px **top gutter**
  (`EDIT_HEADROOM`) — the tree glides down on the relayout slide to make it
  — so a top-row person's parent slots have real room above instead of
  clamping onto their face; the camera-refit effect measures the world
  WITHOUT the gutter, so toggling the pencil never resets pan/zoom. Each slot carries dashed preview paths that trace the exact
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
  the same way, and a thread born with the payload fades in on the tail of
  the slide.
- Relayout motion (2026-08-28, second pass): when an addition re-arranges
  the rows, existing nodes **slide** to their new places and the threads
  **morph** along — the prototype's `transition: left/top` + `transition: d`.
  react-native-svg cannot tween a path's `d`, so
  `use-animated-tree-layout.ts` animates the LAYOUT instead: a ~550ms
  requestAnimationFrame tween interpolates every shared node's coordinates
  and re-renders nodes, threads, row labels and slot previews from the
  in-between layout each frame — the threads morph for free because they are
  recomputed from the sliding endpoints with the same path functions as
  ever. A re-render per frame is exactly what the pinch/pan layer avoids,
  but a relayout is a rare sub-second event, not a gesture. Sizes, pan
  bounds and the refit stay on the TARGET layout, so the camera aims where
  things settle; a payload arriving mid-slide starts the next tween from
  wherever things are currently drawn.

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

Done 2026-08-27: min spacing with a wider world + fit-to-view, the
unplaced strip, sibling parent-edge inference. Done 2026-08-28: edit-mode
slots ("add here" on the canvas) and the relayout slide/morph
(`use-animated-tree-layout.ts`). Done 2026-08-31: the prototype-replay
placement (the opening draw-on was tried and removed — section above).

Still open: **a computed layout** (`d3-hierarchy` or hand-rolled
Reingold–Tilford) remains the eventual step if a tree ever needs
structure-perfect geometry — family graphs are not strict trees, so naive
tidy-tree needs adaptation, and it would trade away the replay's stability;
only worth it if organic settling visibly fails on a real family.

Known gaps, accepted for now: the everyone-shifts-down parent insert (a
new grandparent relabels every generation); a parent stands exactly over
their children only at the moment the pair is seated — later additions
settle around them rather than re-centring anybody; threads may cross on a
genuinely tangled graph (a child's two parents seated far apart); a
sibling created by a non-invite path without parent edges still floats
unconnected.

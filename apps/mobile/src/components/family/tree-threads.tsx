import { useRef } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../../theme';
import {
  coupleJoint,
  couplePath,
  descentPath,
  singleDescentPath,
  type FamilyTreeData,
  type TreeLayout,
} from './tree-layout';

const STROKE = 2.2;
/** A thread to someone who has not accepted yet. */
const PENDING_DASH = [3, 7];
/** Edit mode's slot previews — airier than pending, clearly not real yet. */
const SLOT_DASH = [4, 8];

export type TreeThreadsProps = {
  data: FamilyTreeData;
  layout: TreeLayout;
  width: number;
  height: number;
  /**
   * The relayout slide's 0→1 (1 at rest, from `use-animated-tree-layout.ts`).
   * Threads born with this payload fade in against it, so a new edge arrives
   * with the motion instead of popping fully drawn on the first frame.
   */
  progress?: number;
  /**
   * Dashed previews for edit mode's empty slots — each traces the exact
   * thread that will exist once the person is added (`tree-slots.ts`).
   */
  slotPaths?: string[];
};

const coupleKey = (a: string, b: string) => `couple-${a}-${b}`;
const descentKey = (a: string, b: string, to: string) => `descent-${a}-${b}-${to}`;

/**
 * Every relationship in one SVG layer, drawn under the nodes.
 *
 * Threads are a single curved stroke leaving the couple's joint and entering
 * the child's avatar edge — organic beziers, never right-angle branch lines.
 * A single known parent's thread is the prototype's S-curve from their own
 * chin instead (`singleDescentPath`).
 */
export function TreeThreads({
  data,
  layout,
  width,
  height,
  progress = 1,
  slotPaths,
}: TreeThreadsProps) {
  const { nodes } = layout;

  /**
   * Which threads were born with THIS payload. Keyed to `data`'s identity
   * rather than diffed per render — the relayout slide re-renders every
   * frame, and a per-render diff would call an edge "known" from its second
   * frame on. Same bookkeeping as the nodes' `appearRef` in family-tree.tsx.
   */
  const bornRef = useRef<{
    data: FamilyTreeData | null;
    known: Set<string> | null;
    fresh: Set<string>;
  }>({ data: null, known: null, fresh: new Set() });
  if (bornRef.current.data !== data) {
    const keys = new Set<string>([
      ...data.couples.map(({ members: [a, b] }) => coupleKey(a, b)),
      ...data.descents.map(({ from: [a, b], to }) => descentKey(a, b, to)),
    ]);
    const previouslyKnown = bornRef.current.known;
    bornRef.current = {
      data,
      known: keys,
      fresh:
        previouslyKnown === null
          ? new Set()
          : new Set([...keys].filter((key) => !previouslyKnown.has(key))),
    };
  }
  // The tail of the slide: a born thread stays invisible while everyone is
  // still travelling hardest, then fades in as the layout settles.
  const bornOpacity = Math.max(0, (progress - 0.35) / 0.65);
  const opacityFor = (key: string) => (bornRef.current.fresh.has(key) ? bornOpacity : 1);

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
      {slotPaths?.map((d, index) => (
        <Path
          key={`slot-${index}`}
          d={d}
          stroke={colors.coral.borderLight}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={SLOT_DASH}
        />
      ))}

      {data.couples.map(({ members: [aId, bId] }) => {
        const a = nodes.get(aId);
        const b = nodes.get(bId);
        if (a === undefined || b === undefined) return null;

        return (
          <Path
            key={coupleKey(aId, bId)}
            d={couplePath(a, b)}
            stroke={colors.coral.borderLight}
            strokeWidth={STROKE}
            strokeOpacity={opacityFor(coupleKey(aId, bId))}
            strokeLinecap="round"
            fill="none"
          />
        );
      })}

      {data.descents.map(({ from: [aId, bId], to }) => {
        const a = nodes.get(aId);
        const b = nodes.get(bId);
        const child = nodes.get(to);
        if (a === undefined || b === undefined || child === undefined) return null;
        const d = aId === bId ? singleDescentPath(a, child) : descentPath(coupleJoint(a, b), child);

        return (
          <Path
            key={descentKey(aId, bId, to)}
            d={d}
            stroke={colors.coral.borderLight}
            strokeWidth={STROKE}
            strokeOpacity={opacityFor(descentKey(aId, bId, to))}
            strokeLinecap="round"
            fill="none"
            // A dashed thread is the only cue that a spot is reserved but
            // still empty — it keeps the tree from looking broken.
            strokeDasharray={child.state === 'pending' ? PENDING_DASH : undefined}
          />
        );
      })}

      {data.couples.map(({ members: [aId, bId] }) => {
        const a = nodes.get(aId);
        const b = nodes.get(bId);
        if (a === undefined || b === undefined) return null;
        const joint = coupleJoint(a, b);

        return (
          <Circle
            key={`joint-${aId}-${bId}`}
            cx={joint.x}
            cy={joint.y}
            r={4}
            fill={colors.coral.primary}
            fillOpacity={opacityFor(coupleKey(aId, bId))}
          />
        );
      })}
    </Svg>
  );
}

import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../../theme';
import {
  coupleJoint,
  couplePath,
  descentPath,
  type FamilyTreeData,
  type TreeLayout,
} from './tree-layout';

const STROKE = 2.2;
/** A thread to someone who has not accepted yet. */
const PENDING_DASH = [3, 7];

export type TreeThreadsProps = {
  data: FamilyTreeData;
  layout: TreeLayout;
  width: number;
  height: number;
};

/**
 * Every relationship in one SVG layer, drawn under the nodes.
 *
 * Threads are a single curved stroke leaving the couple's joint and entering
 * the child's avatar edge — organic beziers, never right-angle branch lines.
 */
export function TreeThreads({ data, layout, width, height }: TreeThreadsProps) {
  const { nodes } = layout;

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
      {data.couples.map(({ members: [aId, bId] }) => {
        const a = nodes.get(aId);
        const b = nodes.get(bId);
        if (a === undefined || b === undefined) return null;

        return (
          <Path
            key={`couple-${aId}-${bId}`}
            d={couplePath(a, b)}
            stroke={colors.coral.borderLight}
            strokeWidth={STROKE}
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

        return (
          <Path
            key={`descent-${aId}-${bId}-${to}`}
            d={descentPath(coupleJoint(a, b), child)}
            stroke={colors.coral.borderLight}
            strokeWidth={STROKE}
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
            r={3}
            fill={colors.coral.primary}
          />
        );
      })}
    </Svg>
  );
}

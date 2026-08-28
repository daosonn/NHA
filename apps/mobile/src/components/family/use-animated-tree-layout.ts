/**
 * Slides the tree between two arrangements — the prototype's
 * `transition: left/top` on nodes and `transition: d` on threads
 * (`src/family-tree-canvas.html`), rebuilt for React Native.
 *
 * The browser tweens a path's `d` attribute natively; react-native-svg
 * cannot. So instead of animating each drawn thing, this hook animates the
 * LAYOUT: a ~half-second requestAnimationFrame tween interpolates every
 * node's (and row label's) position from where it was drawn to where the new
 * arrangement puts it, and each frame re-renders nodes, threads and slot
 * previews from the interpolated coordinates — so the threads morph for
 * free, because they are recomputed from the sliding endpoints with the same
 * path functions as ever. A re-render per frame is exactly what the
 * pinch/pan layer avoids, but a relayout is a rare, sub-second event, not a
 * gesture — ~30 frames over a few dozen nodes is nothing.
 *
 * Interruption-safe: a payload arriving mid-slide starts the next tween from
 * wherever things are currently drawn, not from the abandoned target.
 */

import { useEffect, useRef, useState } from 'react';

import type { PositionedNode, TreeLayout } from './tree-layout';

const DURATION_MS = 550;

/** Stand-in for the prototype's cubic-bezier(0.22, 1, 0.36, 1) slide curve. */
function ease(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Did anyone who exists in both arrangements actually change place? */
function moved(from: TreeLayout, to: TreeLayout): boolean {
  for (const [id, node] of to.nodes) {
    const prev = from.nodes.get(id);
    if (prev === undefined) continue;
    if (Math.abs(prev.x - node.x) > 0.5 || Math.abs(prev.y - node.y) > 0.5) return true;
  }
  return false;
}

/**
 * The target arrangement with everyone still travelling: shared ids lerp,
 * new people sit at their final spot from the first frame (they pop in
 * there, like the prototype), and the leaving simply stop being drawn.
 * Width/height stay the target's — the world resizes once, up front, so the
 * refit that follows an addition aims where things will settle.
 */
function lerpLayout(from: TreeLayout, to: TreeLayout, t: number): TreeLayout {
  const nodes = new Map<string, PositionedNode>();
  for (const [id, node] of to.nodes) {
    const prev = from.nodes.get(id);
    nodes.set(
      id,
      prev === undefined
        ? node
        : { ...node, x: prev.x + (node.x - prev.x) * t, y: prev.y + (node.y - prev.y) * t },
    );
  }
  const rows = to.rows.map((row) => {
    const prev = from.rows.find((candidate) => candidate.id === row.id);
    return prev === undefined ? row : { ...row, y: prev.y + (row.y - prev.y) * t };
  });
  return { nodes, rows, width: to.width, height: to.height };
}

export type AnimatedTreeLayout = {
  /** What to draw this frame. Identical to the target while nothing moves. */
  layout: TreeLayout;
  /**
   * 0→1 across a slide, 1 at rest — threads born in this arrangement fade
   * in against it, so a new edge arrives with the motion instead of popping
   * fully drawn a frame early.
   */
  progress: number;
};

export function useAnimatedTreeLayout(target: TreeLayout): AnimatedTreeLayout {
  const [frame, setFrame] = useState<AnimatedTreeLayout>({ layout: target, progress: 1 });
  /** Whatever the screen currently shows — the honest start of any tween. */
  const shown = useRef(target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const stop = () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };

    const from = shown.current;
    // Nothing travelled (first payload, a refetch, a whole-family switch):
    // draw the target as-is. New-thread fades only accompany real motion.
    if (!moved(from, target)) {
      shown.current = target;
      setFrame({ layout: target, progress: 1 });
      return stop;
    }

    const started = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - started) / DURATION_MS);
      const eased = ease(t);
      const layout = t >= 1 ? target : lerpLayout(from, target, eased);
      shown.current = layout;
      setFrame({ layout, progress: eased });
      raf.current = t >= 1 ? null : requestAnimationFrame(step);
    };
    stop();
    raf.current = requestAnimationFrame(step);
    return stop;
  }, [target]);

  return frame;
}

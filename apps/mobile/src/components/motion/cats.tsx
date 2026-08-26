import { useEffect } from 'react';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Text as SvgText } from 'react-native-svg';

/**
 * The four cats from the motion kit (`docs/01-frontend/motion/nha-cats.svg`),
 * with their CSS animations translated to Reanimated: `nhaTail` (the wag),
 * `nhaEar` (the twitch), `nhaBob`, `nhaSleep` (the breath) and `nhaPeek`
 * (the one-shot entrance).
 *
 * The kit's rule (`README.md`): cats appear ONLY at one-time emotional
 * moments — waiting on AI past 10 seconds, an empty state, and a
 * just-sent/done screen. Never in chrome, never on daily actions.
 *
 * Colours are the kit's own, deliberately literal: the cat is an
 * illustration, not themed UI, and must not drift when a token does.
 *
 * Every viewBox is padded past the kit's own: an `Svg` clips at its canvas,
 * so a wagging tail or a twitching ear drawn to the exact bounding box loses
 * its tip mid-swing. (The peek cat keeps its bottom edge flush — it is
 * peeking over that edge by design.)
 */

const CORAL = '#F58B7B';
const CREAM = '#FDE7E2';
const INK = '#18181B';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);

const inOut = Easing.inOut(Easing.ease);

/**
 * Rotation about a point in the drawing's own coordinates, as an SVG
 * transform string. The `origin`/`rotation` props would say the same thing,
 * but react-native-svg's web build turns them into a `transform-origin` DOM
 * attribute React rejects — the composed string works on every platform.
 */
export function rotateAbout(angle: number, x: number, y: number): string {
  'worklet';
  return `translate(${x} ${y}) rotate(${angle}) translate(${-x} ${-y})`;
}

/** `nhaTail` — the tail swings -8° → 14° and back, forever. */
function useTailWag(periodMs: number, originX: number, originY: number, delayMs = 0) {
  const angle = useSharedValue(-8);

  useEffect(() => {
    angle.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(14, { duration: periodMs / 2, easing: inOut }),
          withTiming(-8, { duration: periodMs / 2, easing: inOut }),
        ),
        -1,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once.
  }, []);

  return useAnimatedProps(() => ({ transform: rotateAbout(angle.value, originX, originY) }));
}

/** `nhaEar` — still for ~2.8s of every 3.2s, then a quick two-way twitch. */
function useEarTwitch(originX: number, originY: number, delayMs = 0) {
  const angle = useSharedValue(0);

  useEffect(() => {
    angle.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withDelay(2816, withTiming(-9, { duration: 128, easing: inOut })),
          withTiming(6, { duration: 128, easing: inOut }),
          withTiming(0, { duration: 128, easing: inOut }),
        ),
        -1,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once.
  }, []);

  return useAnimatedProps(() => ({ transform: rotateAbout(angle.value, originX, originY) }));
}

/** `nhaBob` — the whole cat rises 4px and settles, forever. */
function useBob() {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1300, easing: inOut }),
        withTiming(0, { duration: 1300, easing: inOut }),
      ),
      -1,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once.
  }, []);

  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
}

/** `nhaSleep` — a slow breath: the whole cat swells 3.5% and eases back. */
function useBreath() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 1300, easing: inOut }),
        withTiming(1, { duration: 1300, easing: inOut }),
      ),
      -1,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once.
  }, []);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

/**
 * `nhaZzz` — one "z" drifting up and to the right from the sleeper's head:
 * fades in over the first 30% of the trip, grows the whole way, gone by the
 * top. Loops forever; each z gets its own phase via `delayMs`.
 */
function useZzz(periodMs: number, delayMs: number, x: number, y: number) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delayMs,
      withRepeat(withTiming(1, { duration: periodMs, easing: Easing.linear }), -1),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once.
  }, []);

  return useAnimatedProps(() => {
    const p = progress.value;
    const opacity = p < 0.3 ? (p / 0.3) * 0.9 : 0.9 * (1 - (p - 0.3) / 0.7);
    const scale = 0.7 + 0.45 * p;
    return {
      opacity,
      transform: `translate(${x + 9 * p} ${y - 20 * p}) scale(${scale})`,
    };
  });
}

/** `nhaPeek` — one-shot: rises 16px past its spot by 4px, then settles. */
function usePeekIn() {
  const y = useSharedValue(16);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 290, easing: inOut });
    y.value = withSequence(
      withTiming(-4, { duration: 290, easing: inOut }),
      withTiming(0, { duration: 230, easing: inOut }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once.
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));
}

/** Shared head-and-face of the sitting/happy cats; the eyes differ. */
function CatFace({ happyEyes }: { happyEyes: boolean }) {
  return (
    <>
      <Path
        d="M21 28.4 Q18 13.6 20.2 12.6 Q27.4 15.8 33.6 22.6 Q26.6 27.8 21 28.4 Z"
        fill={CORAL}
      />
      <Path
        d="M51 28.4 Q54 13.6 51.8 12.6 Q44.6 15.8 38.4 22.6 Q45.4 27.8 51 28.4 Z"
        fill={CORAL}
      />
      <Path
        d="M23.4 25.8 Q21.9 18.4 23.4 17.8 Q27.6 20 30.8 23.2 Q26.6 25.6 23.4 25.8 Z"
        fill={CREAM}
      />
      <Path
        d="M48.6 25.8 Q50.1 18.4 48.6 17.8 Q44.4 20 41.2 23.2 Q45.4 25.6 48.6 25.8 Z"
        fill={CREAM}
      />
      <Ellipse cx={36} cy={40} rx={19} ry={18} fill={CORAL} />
      {happyEyes ? (
        <>
          <Path
            d="M26.6 36.4 q2.6-3 5.2 0"
            stroke={INK}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M39.6 36.4 q2.6-3 5.2 0"
            stroke={INK}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        </>
      ) : (
        <>
          <Path
            d="M27.4 36 q2.4 2.6 4.8 0"
            stroke={INK}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M39.8 36 q2.4 2.6 4.8 0"
            stroke={INK}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
      <Path
        d="M32.4 41.4 q1.7 2.8 3.35 0 q1.65 2.8 3.35 0"
        stroke={INK}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Ria dời ra ngoài 2px so với kit (2026-08-25) — đầu trong sát mắt quá. */}
      <Path
        d="M12 37 L21 38.6 M12 42.6 L21 41.8 M60 37 L51 38.6 M60 42.6 L51 41.8"
        stroke={CREAM}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </>
  );
}

export type CatProps = {
  /** Rendered width; height follows the drawing's own proportions. */
  size?: number;
};

/**
 * The in-progress cat (decided 2026-08-25): eyes down as if minding the work
 * — video renders and anything else that is running. Bobs, wags, twitches.
 */
export function CatSitting({ size = 96 }: CatProps) {
  const tail = useTailWag(1500, 50, 74);
  const ear = useEarTwitch(36, 46, 700);
  const bob = useBob();

  return (
    <Animated.View style={bob}>
      <Svg width={size} height={(size * 94) / 88} viewBox="-8 -8 88 94">
        <AnimatedPath
          animatedProps={tail}
          d="M50 74 q15 2 15-13 t-9-11"
          stroke={CORAL}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
        <Path d="M15 76 q-2-30 21-30 t21 30 z" fill={CORAL} />
        <AnimatedG animatedProps={ear}>
          <CatFace happyEyes={false} />
        </AnimatedG>
      </Svg>
    </Animated.View>
  );
}

/** The finished cat: same pose, happy eyes, quicker tail — a job well done. */
export function CatHappy({ size = 96 }: CatProps) {
  const tail = useTailWag(1100, 50, 74);
  const bob = useBob();

  return (
    <Animated.View style={bob}>
      <Svg width={size} height={(size * 94) / 88} viewBox="-8 -8 88 94">
        <AnimatedPath
          animatedProps={tail}
          d="M50 74 q15 2 15-13 t-9-11"
          stroke={CORAL}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
        <Path d="M15 76 q-2-30 21-30 t21 30 z" fill={CORAL} />
        <CatFace happyEyes />
      </Svg>
    </Animated.View>
  );
}

/** The empty-state cat: nothing here yet, so it curled up and went to sleep. */
export function CatSleeping({ size = 112 }: CatProps) {
  const breath = useBreath();
  const zzzBig = useZzz(1800, 0, 44, 20);
  const zzzSmall = useZzz(1800, 900, 52, 26);

  return (
    <Animated.View style={breath}>
      <Svg width={size} height={(size * 72) / 104} viewBox="-6 -6 104 72">
        <AnimatedSvgText animatedProps={zzzBig} fontSize={10} fontWeight="700" fill={CORAL}>
          z
        </AnimatedSvgText>
        <AnimatedSvgText animatedProps={zzzSmall} fontSize={7} fontWeight="700" fill={CORAL}>
          z
        </AnimatedSvgText>
        <Path d="M14 52 q-4-24 22-24 q30 0 32 16 q2 8-8 8 z" fill={CORAL} />
        <Path
          d="M60 52 q16-2 12-14"
          stroke={CREAM}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        <Path d="M20 33 Q16.6 22.2 18.2 21.4 Q23.6 22.8 28 25.2 Q23.8 31.4 20 33 Z" fill={CORAL} />
        <Path d="M34 30 Q35.4 19 37 18.8 Q40.6 22.4 42 27.2 Q37.6 30 34 30 Z" fill={CORAL} />
        <Circle cx={29} cy={38} r={13} fill={CORAL} />
        <Path
          d="M21.5 37.5 q2.4 2.4 4.8 0"
          stroke={INK}
          strokeWidth={1.8}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M31.5 37.5 q2.4 2.4 4.8 0"
          stroke={INK}
          strokeWidth={1.8}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M25.6 42.4 q1.6 2.4 3.1 0 q1.5 2.4 3.1 0"
          stroke={INK}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Ria dời ra ngoài 2px so với kit (2026-08-25), cùng lý do CatFace. */}
        <Path
          d="M11.5 36.5 L19 38.4 M11 41.6 L19 41.4 M47.5 36.5 L40 38.4 M48 41.6 L40 41.4"
          stroke={CREAM}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

/** Peeks over an edge, one-shot entrance — for a moment with little height. */
export function CatPeek({ size = 84 }: CatProps) {
  const tail = useTailWag(1400, 42, 33, 420);
  const ear = useEarTwitch(23, 34, 600);
  const peek = usePeekIn();

  return (
    <Animated.View style={peek}>
      <Svg width={size} height={(size * 42) / 82} viewBox="-6 -8 82 42">
        <AnimatedPath
          animatedProps={tail}
          d="M42 33 q11 1 13-7 t-4-9"
          stroke={CORAL}
          strokeWidth={3.4}
          strokeLinecap="round"
          fill="none"
        />
        <AnimatedG animatedProps={ear}>
          <Path d="M8.6 16 Q7.2 4.4 8.8 3.6 Q14.6 6.6 19 11.2 Q13 15.4 8.6 16 Z" fill={CORAL} />
          <Path d="M37.4 16 Q38.8 4.4 37.2 3.6 Q31.4 6.6 27 11.2 Q33 15.4 37.4 16 Z" fill={CORAL} />
          <Path d="M11 14 Q10.3 8.4 11.3 8 Q14 9.8 16.4 11.8 Q13.2 13.8 11 14 Z" fill={CREAM} />
          <Path d="M35 14 Q35.7 8.4 34.7 8 Q32 9.8 29.6 11.8 Q32.8 13.8 35 14 Z" fill={CREAM} />
          <Path d="M6 24 Q6 10 23 10 Q40 10 40 24 L40 34 L6 34 Z" fill={CORAL} />
          <Path
            d="M16.5 21 q2.2 2.4 4.4 0"
            stroke={INK}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M25.1 21 q2.2 2.4 4.4 0"
            stroke={INK}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M20 24.4 q1.55 2.6 3.05 0 q1.5 2.6 3.05 0"
            stroke={INK}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Ria dời ra ngoài 1.5px so với kit (2026-08-25), cùng lý do CatFace. */}
          <Path
            d="M2.5 22 L9.5 23.4 M2.5 26.6 L9.5 26.2 M43.5 22 L36.5 23.4 M43.5 26.6 L36.5 26.2"
            stroke={CREAM}
            strokeWidth={1.3}
            strokeLinecap="round"
          />
        </AnimatedG>
      </Svg>
    </Animated.View>
  );
}

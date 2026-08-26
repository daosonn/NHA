import { Cake } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors, radius } from '../../theme';
import { rotateAbout } from '../motion/cats';
import { Avatar } from '../ui/avatar';
import { Text } from '../ui/text';

/**
 * The birthday theme for the "Coming up" widget — `theme: CONFETTI_CANDLES`
 * (drafted in `docs/01-frontend/motion/birthday-theme-card.html`, the live
 * spec for every duration in here): a coral-cream card under a swaying garland,
 * drifting confetti, a party hat wobbling on the person's avatar, presents
 * and a cake whose candles flicker. A tap answers with a small firework
 * burst where the finger landed — it navigates nowhere, so it can afford to
 * celebrate instead.
 *
 * Ambient loops animate only SVG transforms and opacity (the kit's rule),
 * each on its own few-second period so the card breathes rather than ticks.
 */

/**
 * Illustration colours, literal on purpose — the cats' rule
 * (`motion/cats.tsx`): decoration is an illustration, not themed UI, and
 * must not drift when a token does. The corals are the exception: those hexes
 * ARE the theme's own, so they come from the tokens.
 */
const DEEP = '#D4604A';
const BLUSH = '#FBD9D0';
const MAUVE = '#966C63';
const YELLOW = '#F0B429';
const GREEN = '#7FA98C';
const PURPLE = '#B893CE';
const CREAM = '#F5E6D8';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const inOut = Easing.inOut(Easing.ease);

// ---------------------------------------------------------------- garland

const FLAG_SPACING = 28;
const FLAG_COLORS = [colors.coral.primary, DEEP, YELLOW, GREEN, PURPLE];

/** One bunting flag, swaying ±3° about its own hanging point, staggered. */
function Flag({ x, index }: { x: number; index: number }) {
  const angle = useSharedValue(-3);

  useEffect(() => {
    angle.value = withDelay(
      index * 240,
      withRepeat(
        withSequence(
          withTiming(3, { duration: 1600, easing: inOut }),
          withTiming(-3, { duration: 1600, easing: inOut }),
        ),
        -1,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once.
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    transform: rotateAbout(angle.value, x, 8),
  }));

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      d={`M${x} 8 L${x + 7} 19 L${x + 14} 8 Z`}
      fill={FLAG_COLORS[index % FLAG_COLORS.length]}
    />
  );
}

/** The rope of flags along the card's top edge, sized to the card. */
function Garland({ width }: { width: number }) {
  const count = Math.max(1, Math.floor(width / FLAG_SPACING));

  let rope = 'M0 8';
  for (let i = 0; i < count; i++) {
    rope += ` Q${i * FLAG_SPACING + FLAG_SPACING / 2} 20 ${(i + 1) * FLAG_SPACING} 8`;
  }

  return (
    <Svg
      width={width}
      height={26}
      style={{ position: 'absolute', top: 0, left: 22 }}
      pointerEvents="none"
    >
      <Path d={rope} stroke={DEEP} strokeWidth={1.6} fill="none" />
      {Array.from({ length: count }, (_, i) => (
        <Flag key={i} x={i * FLAG_SPACING} index={i} />
      ))}
    </Svg>
  );
}

// ---------------------------------------------------------------- confetti

/**
 * Positions as fractions of the card. The first six are the HTML draft's;
 * the last three fill the middle band, because the card runs up to 560px in
 * the content column (the draft was drawn at 353) and confetti clustered in
 * one corner reads as a stain rather than weather.
 */
const DOTS = [
  { x: 0.55, y: 0.05, size: 3, delay: 0, dur: 7000 },
  { x: 0.78, y: 0.18, size: 2.4, delay: 300, dur: 8200 },
  { x: 0.28, y: 0.1, size: 2.2, delay: 600, dur: 6600 },
  { x: 0.88, y: 0.35, size: 2.8, delay: 100, dur: 7600 },
  { x: 0.4, y: 0.02, size: 2, delay: 500, dur: 9000 },
  { x: 0.68, y: 0.08, size: 2.6, delay: 800, dur: 7000 },
  { x: 0.12, y: 0.3, size: 2.4, delay: 200, dur: 8400 },
  { x: 0.48, y: 0.24, size: 2, delay: 700, dur: 7800 },
  { x: 0.93, y: 0.6, size: 2.2, delay: 400, dur: 8800 },
];

function ConfettiDot({
  x,
  y,
  size,
  delay,
  dur,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  dur: number;
}) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: dur / 2, easing: inOut }),
          withTiming(0, { duration: dur / 2, easing: inOut }),
        ),
        -1,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once.
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -6 * p.value }, { translateY: 8 * p.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: colors.coral.brand,
          opacity: 0.5,
        },
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------- party hat

function PartyHat() {
  const angle = useSharedValue(-4);

  useEffect(() => {
    angle.value = withRepeat(
      withSequence(
        withTiming(4, { duration: 1300, easing: inOut }),
        withTiming(-4, { duration: 1300, easing: inOut }),
      ),
      -1,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once.
  }, []);

  // Wobbles about where it sits on the head (15,26), not its own centre.
  const animatedProps = useAnimatedProps(() => ({
    transform: rotateAbout(angle.value, 15, 26),
  }));

  return (
    // viewBox padded past the drawing (the cats' lesson): an Svg clips at its
    // canvas, and a wobbling tip drawn to the exact bounding box loses its pom.
    <Svg
      width={34}
      height={30}
      viewBox="-2 -3 34 30"
      style={{ position: 'absolute', left: 8, top: -18 }}
      pointerEvents="none"
    >
      <AnimatedG animatedProps={animatedProps}>
        <Path d="M15 1 L27 24 L3 24 Z" fill={colors.coral.primary} />
        <Path d="M6 24 L24 24 L25.4 26 L4.6 26 Z" fill={DEEP} />
        <Circle cx={10} cy={10} r={1.6} fill={colors.background.card} />
        <Circle cx={19} cy={14} r={1.6} fill={colors.coral.light} />
        <Circle cx={15} cy={7} r={1.6} fill={colors.background.card} />
        <Circle cx={12} cy={17} r={1.6} fill={colors.coral.light} />
        <Circle cx={15} cy={1} r={2.4} fill={YELLOW} />
      </AnimatedG>
    </Svg>
  );
}

// ---------------------------------------------------------------- backdrop

/**
 * Gradient and drifting confetti, absolute-fill and self-measuring. The
 * garland is NOT here: the card draws it above its content (the draft's
 * z-order), which a backdrop underneath cannot.
 */
function BirthdayBackdrop() {
  const [size, setSize] = useState({ w: 0, h: 0 });

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
      onLayout={(event) =>
        setSize({ w: event.nativeEvent.layout.width, h: event.nativeEvent.layout.height })
      }
    >
      {/* Explicit measured size: an <svg> with no width/height attributes
          falls back to the spec's replaced-element default — 300×150 — so on
          the web the gradient covered a corner and the rest of the card
          showed through. */}
      {size.w > 0 && (
        <>
          <Svg
            width={size.w}
            height={size.h}
            style={{ position: 'absolute', top: 0, left: 0 }}
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id="birthdayCardBg" x1="0" y1="0" x2="0.27" y2="1">
                <Stop offset="0" stopColor={colors.coral.light} />
                <Stop offset="1" stopColor={BLUSH} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#birthdayCardBg)" />
          </Svg>

          {DOTS.map((dot, i) => (
            <ConfettiDot
              key={i}
              x={dot.x * size.w}
              y={dot.y * size.h}
              size={dot.size}
              delay={dot.delay}
              dur={dot.dur}
            />
          ))}
        </>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- cake

const FLAMES = [
  { cx: 30, cy: 11, coreCy: 12, wickX: 29.1, wickY: 12, dur: 420, delay: 0 },
  { cx: 44, cy: 8, coreCy: 9, wickX: 43.1, wickY: 9, dur: 455, delay: 90 },
  { cx: 58, cy: 11, coreCy: 12, wickX: 57.1, wickY: 12, dur: 490, delay: 180 },
];

/** The flicker keyframes: squash/stretch about the flame's own base. */
function flickerTransform(p: number, cx: number, cy: number): string {
  'worklet';
  const sy = interpolate(p, [0, 1, 2, 3, 4], [1, 1.15, 0.9, 1.08, 1]);
  const sx = interpolate(p, [0, 1, 2, 3, 4], [1, 0.92, 1.05, 0.96, 1]);
  const ty = interpolate(p, [0, 1, 2, 3, 4], [0, -0.6, 0.3, -0.3, 0]);
  return `translate(0 ${ty}) translate(${cx} ${cy}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`;
}

function Flame({ flame }: { flame: (typeof FLAMES)[number] }) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      flame.delay,
      withRepeat(
        withSequence(
          withTiming(4, { duration: flame.dur, easing: Easing.linear }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- starts once.
  }, []);

  const outer = useAnimatedProps(() => ({
    transform: flickerTransform(p.value, flame.cx, flame.cy),
  }));
  const core = useAnimatedProps(() => ({
    transform: flickerTransform(p.value, flame.cx, flame.coreCy),
  }));

  return (
    <>
      <Rect x={flame.wickX} y={flame.wickY} width={1.8} height={10} fill={CREAM} />
      <AnimatedEllipse
        animatedProps={outer}
        cx={flame.cx}
        cy={flame.cy}
        rx={2.4}
        ry={3.4}
        fill={colors.coral.brand}
      />
      <AnimatedEllipse
        animatedProps={core}
        cx={flame.cx}
        cy={flame.coreCy}
        rx={1.1}
        ry={1.6}
        fill={YELLOW}
      />
    </>
  );
}

/**
 * The presents and the cake, scaled with the card: the draft drew them for a
 * 353px phone card, and at the column's 560px they left the whole bottom
 * band empty. `viewBox` keeps every coordinate (and the flame animations) in
 * the drawing's own space while the canvas grows.
 */
function CakeAndPresents({ scale }: { scale: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingVertical: 2,
      }}
    >
      {/* Two presents with ribbon bows. */}
      <Svg width={70 * scale} height={46 * scale} viewBox="0 0 70 46">
        <Rect x={4} y={20} width={26} height={24} rx={3} fill={YELLOW} />
        <Rect x={4} y={30} width={26} height={6} fill={DEEP} />
        <Rect x={14} y={20} width={6} height={24} fill={DEEP} />
        <Path d="M17 20 q-7-10 -1-14 q4 3 1 14 Z" fill={DEEP} />
        <Path d="M17 20 q7-10 1-14 q-4 3 -1 14 Z" fill={DEEP} />
        <Rect x={34} y={10} width={30} height={34} rx={3} fill={GREEN} />
        <Rect x={34} y={22} width={30} height={6} fill={CREAM} />
        <Rect x={46} y={10} width={6} height={34} fill={CREAM} />
        <Path d="M49 10 q-8-9 -1-13 q5 3 1 13 Z" fill={YELLOW} />
        <Path d="M49 10 q8-9 1-13 q-5 3 -1 13 Z" fill={YELLOW} />
      </Svg>

      {/* Two-tier cake, three lit candles. */}
      <Svg width={88 * scale} height={54 * scale} viewBox="0 0 88 54">
        <Ellipse cx={44} cy={49} rx={38} ry={5} fill={DEEP} opacity={0.16} />
        <Rect x={6} y={30} width={76} height={18} rx={4} fill={colors.coral.brand} />
        <Rect x={6} y={30} width={76} height={5} rx={2.5} fill={BLUSH} />
        <Rect x={13} y={17} width={62} height={14} rx={4} fill={colors.coral.primary} />
        <Rect x={13} y={17} width={62} height={5} rx={2.5} fill={colors.coral.light} />
        <G fill={DEEP}>
          <Circle cx={22} cy={26} r={2} />
          <Circle cx={37} cy={23} r={2} />
          <Circle cx={52} cy={26} r={2} />
          <Circle cx={67} cy={23} r={2} />
        </G>
        {FLAMES.map((flame) => (
          <Flame key={flame.cx} flame={flame} />
        ))}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------- fireworks

/**
 * Five bursts fanning out from the tap, offsets as fractions of the card so
 * the volley covers it at any width — three fixed pixel offsets (the draft's)
 * covered a corner of the 560px card and read as a misfire.
 */
const BURSTS = [
  { fx: 0, fy: 0, color: colors.coral.primary, inner: YELLOW, delay: 0, r: 26 },
  { fx: 0.18, fy: -0.16, color: DEEP, inner: colors.coral.light, delay: 80, r: 22 },
  { fx: -0.16, fy: 0.18, color: YELLOW, inner: colors.coral.primary, delay: 160, r: 22 },
  { fx: 0.34, fy: 0.12, color: GREEN, inner: CREAM, delay: 240, r: 18 },
  { fx: -0.32, fy: -0.14, color: PURPLE, inner: BLUSH, delay: 320, r: 18 },
];

/**
 * One spark: a dot flying outward from the burst's centre, shrinking and
 * fading as it goes. The first cut drew 8 lines anchored AT the centre and
 * scaled the group — spokes that stayed joined in the middle the whole way,
 * which reads as a spiderweb, not a firework. Particles that leave an
 * opening hole behind them are what a burst actually looks like.
 */
function Spark({
  p,
  cx,
  cy,
  angle,
  dist,
  size,
  lag,
  color,
}: {
  p: SharedValue<number>;
  cx: number;
  cy: number;
  angle: number;
  /** How far this particle flies. */
  dist: number;
  /** Its size at ignition — it shrinks as it goes. */
  size: number;
  /** Fraction of the burst this particle waits out — inner shells fire late. */
  lag: number;
  color: string;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = interpolate(p.value, [lag, 1], [0, 1], Extrapolation.CLAMP);
    const d = interpolate(t, [0, 1], [dist * 0.15, dist]);
    return {
      cx: cx + Math.cos(angle) * d,
      cy: cy + Math.sin(angle) * d,
      r: interpolate(t, [0, 1], [size, size * 0.4]),
      opacity: interpolate(t, [0, 0.2, 0.7, 1], [0, 1, 0.9, 0]),
    };
  });

  return <AnimatedCircle animatedProps={animatedProps} fill={color} />;
}

/**
 * Three shells per burst, interleaved: the outer 8 in the burst's colour,
 * a middle 8 half a spoke-step behind them in the partner colour, and a
 * small late core. The stagger in angle, distance, size and timing is what
 * makes it read as a firework blooming rather than one ring of dots.
 */
const SHELLS = [
  { count: 8, distF: 1, size: 2.6, lag: 0, step: 0 },
  { count: 8, distF: 0.62, size: 1.9, lag: 0.12, step: 0.5 },
  { count: 5, distF: 0.34, size: 1.5, lag: 0.24, step: 0.2 },
];

function FireworkRing({
  cx,
  cy,
  color,
  inner,
  delay,
  r,
  angleOffset,
}: {
  cx: number;
  cy: number;
  color: string;
  /** The interleaved shells' colour — a lighter partner to the outer one. */
  inner: string;
  delay: number;
  r: number;
  /** Staggers the rings' spoke angles so the volley doesn't align. */
  angleOffset: number;
}) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(
      delay,
      withTiming(1, { duration: 900, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot.
  }, []);

  return (
    <>
      {SHELLS.map((shell, s) =>
        Array.from({ length: shell.count }, (_, k) => (
          <Spark
            key={`${s}-${k}`}
            p={p}
            cx={cx}
            cy={cy}
            angle={angleOffset + ((k + shell.step) / shell.count) * Math.PI * 2}
            dist={r * shell.distF}
            size={shell.size}
            lag={shell.lag}
            color={s === 0 ? color : inner}
          />
        )),
      )}
    </>
  );
}

// ---------------------------------------------------------------- the card

export type BirthdayCardProps = {
  /** The tag pill's word ("Birthday") — uppercased here. */
  tag: string;
  /** "Grandma turns 70" — worded by the caller, one source for all screens. */
  title: string;
  /** "Sunday 30 August · in 11 days", or null when the date failed to parse. */
  subtitle: string | null;
  /** "2 more coming up", or null. */
  more: string | null;
  /** Whose birthday it is — drawn as the avatar under the party hat. */
  avatarName?: string;
  /** Their photo, where the caller can resolve one (Home's widget cannot). */
  avatarMediaId?: string | null;
};

export function BirthdayCard({
  tag,
  title,
  subtitle,
  more,
  avatarName,
  avatarMediaId = null,
}: BirthdayCardProps) {
  const cardRef = useRef<View>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [burst, setBurst] = useState<{ x: number; y: number; seq: number } | null>(null);

  // The illustrations were drawn for the 353px phone card; on the column's
  // wider cards they grow with it, capped before they turn into wallpaper.
  const scale = size.w > 0 ? Math.min(1.5, Math.max(1, size.w / 353)) : 1;

  // The volley unmounts itself — its animation is spent well within this.
  useEffect(() => {
    if (burst === null) return;
    const id = setTimeout(() => setBurst(null), 1400);
    return () => clearTimeout(id);
  }, [burst]);

  return (
    <Pressable
      ref={cardRef}
      onLayout={(event) =>
        setSize({ w: event.nativeEvent.layout.width, h: event.nativeEvent.layout.height })
      }
      // No accessibilityRole: the tap is a celebration, not an action — a
      // screen reader should not announce a button that navigates nowhere.
      onPress={(event) => {
        // `locationX` does not exist on react-native-web (its nativeEvent is
        // a DOM event), so every tap landed on the centre fallback there. Page
        // coordinates exist on both platforms; the card's own window position
        // turns them into card-local ones.
        const { pageX, pageY } = event.nativeEvent;
        cardRef.current?.measureInWindow((x, y) => {
          setBurst((prev) => ({ x: pageX - x, y: pageY - y, seq: (prev?.seq ?? 0) + 1 }));
        });
      }}
      style={[
        {
          // The photo card's fixed height — the slot must not jump when the
          // theme does.
          minHeight: 196,
          // The gradient's own top colour, as the base coat: the Svg below
          // needs a measured size, so for the first frame this is the card.
          backgroundColor: colors.coral.light,
          borderRadius: radius['4xl'],
          borderWidth: 3,
          borderColor: colors.background.card,
          overflow: 'hidden',
        },
        // The widget's frame, shared with the photo card so the slot reads the
        // same whichever theme is up.
        { boxShadow: '0 10px 28px rgba(24,24,27,0.1), 0 0 0 1px rgba(24,24,27,0.07)' },
      ]}
    >
      <BirthdayBackdrop />

      {/* space-between so the rows spread into whatever the minHeight adds;
          the gap stays as the floor between them on the smallest card. */}
      <View style={{ flexGrow: 1, padding: 16, gap: 13, justifyContent: 'space-between' }}>
        <View
          style={{
            alignSelf: 'flex-start',
            height: 24,
            paddingHorizontal: 11,
            borderRadius: radius.full,
            backgroundColor: colors.background.card,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Cake size={13} color={DEEP} strokeWidth={2.3} />
          <Text
            variant="badge"
            weight="semibold"
            color={colors.coral.deep}
            style={{ letterSpacing: 0.3 }}
          >
            {tag.toLocaleUpperCase()}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 50, height: 50 }}>
            <Avatar size={50} name={avatarName} mediaId={avatarMediaId} />
            <PartyHat />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text variant="body1" weight="semibold" numberOfLines={1}>
              {title}
            </Text>
            {subtitle !== null && (
              <Text variant="caption" color={MAUVE} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
            {more !== null && (
              <Text variant="caption" color={MAUVE}>
                {more}
              </Text>
            )}
          </View>
        </View>

        <CakeAndPresents scale={scale} />
      </View>

      {size.w > 0 && <Garland width={size.w - 22} />}

      {burst !== null && size.w > 0 && (
        <Svg
          key={burst.seq}
          width={size.w}
          height={size.h}
          style={{ position: 'absolute', top: 0, left: 0 }}
          pointerEvents="none"
        >
          {BURSTS.map((b, i) => (
            <FireworkRing
              key={i}
              cx={burst.x + b.fx * size.w}
              cy={burst.y + b.fy * size.h}
              color={b.color}
              inner={b.inner}
              delay={b.delay}
              r={b.r * scale}
              angleOffset={i * 0.35}
            />
          ))}
        </Svg>
      )}
    </Pressable>
  );
}

import { BlurView } from 'expo-blur';
import { usePathname, useRouter } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSoftRefresh } from '../../features/ui/soft-refresh';
import { colors, elevation, layout, radius, spacing } from '../../theme';
import { BrandMark } from '../ui/brand-mark';
import { Text } from '../ui/text';
import { TABS } from './bottom-nav';

/**
 * The four destinations, with the route each one opens.
 *
 * The bottom bar gets these from the navigator it is drawn inside. This one is
 * mounted above the navigator — so that a pushed screen keeps its navigation,
 * the way a web app does — and therefore has to name the paths itself. Labels
 * and glyphs still come from `TABS`, so only the paths live here.
 */
const DESTINATIONS: readonly {
  name: keyof typeof TABS;
  href: '/' | '/omoide' | '/family' | '/ai' | '/profile';
}[] = [
  { name: 'index', href: '/' },
  { name: 'omoide', href: '/omoide' },
  { name: 'family', href: '/family' },
  { name: 'ai', href: '/ai' },
  { name: 'profile', href: '/profile' },
];

const ITEM = 48;
const ICON = 22;
/**
 * The accented glyph, drawn larger than the rest.
 *
 * Two attempts at a coral disc were read as a smudge rather than a mark
 * (owner's calls, 2026-08-26 and 27) — a filled shape among five line
 * drawings keeps looking like a button that wandered in. Size and colour say
 * "this one matters" without introducing a different kind of object, and
 * with nothing positioned there is no paint-order trap on web either.
 */
const ACCENT_ICON = 28;
/** Side padding of the panel. Everything inside is measured from it. */
const PAD = 14;
/**
 * Left padding inside a row, chosen so the glyph is dead centre of the closed
 * bar: 14 + 13 + 11 = 38, and 38 is half of 76. It does not change when the bar
 * opens, which is what keeps the glyphs still under the pointer while the
 * labels arrive beside them.
 */
const ROW_PAD = 13;
const GAP = 12;
/** Clears the rounded caps, so the mark is not cut by one. */
const PAD_Y = 18;

/**
 * Half the closed width, so the bar is a true vertical pill at rest — the
 * bottom bar's shape, stood up.
 *
 * Not `radius.full`: the browser clamps a radius to half the *shorter* side,
 * which is the width here, so `full` would grow the corners to 120 as the bar
 * opens and turn a rounded panel into a lozenge. Fixed at 38 the corner never
 * changes, and nothing surprising happens halfway through the animation.
 */
const RADIUS = layout.navRail / 2;

const OPEN_MS = 170;
const CLOSE_MS = 130;

function Row({
  label,
  icon: Icon,
  tint,
  background,
  strokeWidth,
  accessibilityRole,
  accent = false,
  selected,
  open,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  tint: string;
  background: string;
  strokeWidth: number;
  accessibilityRole: 'tab' | 'button';
  /** Filled coral disc instead of a line glyph — see `TabConfig.accent`. */
  accent?: boolean;
  selected?: boolean;
  /** 0 closed, 1 open — the label rides it in. */
  open: SharedValue<number>;
  onPress: () => void;
}) {
  const labelStyle = useAnimatedStyle(() => ({
    // Held at zero until the panel is well on its way. Clipping alone is not
    // enough: the closed rail is 76 wide and the label starts at 61, so a
    // sliver of the first glyph would sit against the edge — which is how this
    // read as "ホ…" rather than as an icon.
    opacity: interpolate(open.value, [0.45, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityState={selected === undefined ? undefined : { selected }}
      // The label is the accessibility label even while it is invisible, so
      // somebody using voice control can still say what the glyph means — and
      // so a screen reader never reads out a bare icon.
      accessibilityLabel={label}
      style={{
        height: ITEM,
        // Square while closed, so `full` draws a circle and the compose action
        // is the same coral disc it is on the bottom bar. Open, the same radius
        // makes it a pill.
        borderRadius: radius.full,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: ROW_PAD,
        gap: GAP,
        backgroundColor: background,
      }}
    >
      {/* The glyph in a box that cannot shrink. This is load-bearing: on web
          `react-native-svg` renders a real `<svg>`, which does not inherit
          react-native-web's `flex-shrink: 0` the way a `View` or `Text` does.
          Left to itself it was the only flexible thing in a row too narrow for
          its contents, so it collapsed to a sliver and the closed rail showed
          four truncated words where the icons should have been. */}
      <View
        style={{
          width: ICON,
          height: ICON,
          flexShrink: 0,
          alignItems: 'center',
          justifyContent: 'center',
          // The rail is the same five destinations as the bar, so the tree is
          // marked the same way here — one list, one emphasis, or the two
          // navigations start disagreeing about what matters.
        }}
      >
        <Icon
          size={accent ? ACCENT_ICON : ICON}
          color={accent ? colors.coral.brand : tint}
          strokeWidth={accent ? 2.4 : strokeWidth}
        />
      </View>

      {/* `flexShrink: 0` so the word keeps its natural width and overflows to
          be clipped, rather than ellipsising itself inside a narrow box. */}
      <Animated.View style={[{ flexShrink: 0 }, labelStyle]}>
        <Text weight={selected === true ? 'semibold' : 'medium'} color={tint} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * The navigation, down the left, from 1024px up.
 *
 * A floating bar of five buttons at the bottom of a wide window reads as a
 * remote control: far from the content, far from the pointer, and spending
 * 140–160px of every screen's height on itself. Vertical it costs 76px of width
 * the page had going spare — and it stays on screen while a Life Profile or a
 * post is open, which is what separates a web app from a phone app being looked
 * at through a window.
 *
 * **It is the bottom bar, stood up** — the same glass, the same floating inset,
 * and a corner radius of half its closed width, so at rest it is that bar's
 * pill shape turned vertical. It hugs its contents rather than running the
 * height of the window, and it is centred down that window: a full-height panel
 * with a border is a piece of furniture, and these two navigations should not
 * need explaining separately.
 *
 * **It rests closed, at glyph width, and opens under the pointer.** A 240px
 * panel of labels standing permanently open beside a 600px column spends most
 * of a third of a 1920px window on four words, which is what it looked like
 * when it was tried. Opening **over** the content rather than pushing it is
 * deliberate too: reflowing a feed because a pointer crossed the left edge
 * would be worse than the labels being 170ms away.
 *
 * Nothing moves horizontally while it opens. Every glyph sits at a fixed
 * distance from the left edge — centred in the closed rail by construction, see
 * `ROW_PAD` — so the panel widening only ever reveals what was already beside
 * it. The compose action is a square row with a `full` radius, which means it
 * is a coral disc closed and a coral pill open, with no second component.
 *
 * Two things about a row are less obvious than they look, and both were how
 * the first version of this broke — it showed four truncated *words* where the
 * icons belonged. The glyph lives in a box that cannot shrink, because on web
 * `react-native-svg` renders a real `<svg>` and that does not inherit
 * react-native-web's `flex-shrink: 0`; and the label fades rather than only
 * being clipped, because 76px of rail against a label starting at 61px leaves
 * a sliver of the first character showing at the edge.
 *
 * Hover comes from `onPointerEnter` / `onPointerLeave` on the panel and **not**
 * from wrapping it in a `Pressable`: `react-native-web` turns every
 * `accessibilityRole="button"` into a real `<button>`, and a button around four
 * buttons is invalid markup that swallows the presses inside it — the same trap
 * the group strip is written around.
 *
 * One consequence worth naming: a touch device wide enough for the rail — an
 * iPad in landscape — has no pointer, so it only ever sees the glyphs. The
 * accessibility label carries the word, but visually those readers lose what
 * `design-system.md` § Bottom navigation argues they need. Below 1024px, which
 * is every phone and a portrait tablet, the labelled bottom bar is unchanged.
 */
export function SideNav() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { refresh } = useSoftRefresh();
  const insets = useSafeAreaInsets();

  /** 0 closed, 1 open. */
  const open = useSharedValue(0);

  const panelStyle = useAnimatedStyle(() => ({
    width: interpolate(open.value, [0, 1], [layout.navRail, layout.navRailExpanded]),
  }));

  return (
    // The column the bar reserves is real layout: a flex sibling of the whole
    // navigator, so no screen has to know the bar is there. Wide enough for the
    // bar plus its margin on both sides, so the content next to it starts clear
    // of the glass rather than up against it. Only the *opening* is an overlay.
    <View
      style={{
        width: layout.navRail + layout.navMargin * 2,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: layout.navMargin,
        // Centred down the window rather than hung from the top. The bar is a
        // good deal shorter than the page, and pinned high it read as having
        // slid up out of position — there is no edge up there for it to belong
        // to, the way the bottom bar belongs to the bottom one. Centring is
        // also what puts it nearest the pointer's resting place.
        justifyContent: 'center',
        // Stops the panel being stretched to the column's width; it sets its
        // own, and animates it.
        alignItems: 'flex-start',
        zIndex: 20,
      }}
    >
      <Animated.View
        onPointerEnter={() => {
          open.value = withTiming(1, { duration: OPEN_MS });
        }}
        onPointerLeave={() => {
          open.value = withTiming(0, { duration: CLOSE_MS });
        }}
        style={[
          {
            // Not absolute: the column above centres it, and an absolutely
            // positioned box cannot be centred on its own height without
            // measuring it first. It still overflows the column when it opens —
            // nothing here clips, and the column's fixed width means the
            // content beside it never moves.
            flexShrink: 0,
            paddingVertical: PAD_Y,
            paddingHorizontal: PAD,
            gap: spacing.lg,
            borderRadius: RADIUS,
            // Keeps the labels from spilling past the bar while it is narrow,
            // and keeps the blur inside the rounded corners. The rows fade too
            // — see `Row` — because clipping alone still leaves a sliver of the
            // first character against the edge.
            overflow: 'hidden',
          },
          // The bottom bar's lift, not the header's: this floats over the page
          // rather than sitting against an edge of it.
          elevation.floating,
          panelStyle,
        ]}
      >
        {/* Same glass as the bottom bar, but opaque and outlined here.
            Frosted glass needs something behind it to frost: the bar floats
            over a scrolling feed, while this rail sits against the page
            margin, where 86% white over a #FAF9F8 page composites to within a
            shade of the page itself. The pill's shape was left to its shadow
            alone, and grey glyphs on an almost-invisible surface read as
            washed out. Card white with a hairline gives the rail an edge and
            the icons a ground to sit on.

            It is a filled layer behind the contents rather than a wrapper
            around them, because a `BlurView` that owns the children would
            also own the pointer events the rail needs for its hover. */}
        <BlurView
          intensity={30}
          tint="light"
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: colors.background.card,
              // RADIUS, never `full`. A radius is clamped to half the box,
              // and this box changes width: closed it is 76 so `full` lands
              // on 38 and agrees with the container by luck, but a hover
              // opens it to 240 and `full` becomes 120 while the container
              // still clips at 38 — which drew a great arc straight across
              // the open rail. Reported 2026-08-27.
              borderRadius: RADIUS,
              borderWidth: 1,
              borderColor: colors.state.borderNeutral,
            },
          ]}
        />

        {/* The mark alone while closed. Home's header carries the full lockup,
            so the name is already said once on the screen that has room for
            it; opening the bar is not the moment to say it twice. */}
        <View style={{ paddingLeft: 11 }}>
          <Pressable
            onPress={() => {
              router.navigate('/');
              refresh();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('nav.home')}
            hitSlop={6}
          >
            <BrandMark size={26} />
          </Pressable>
        </View>

        {/* Still no raised disc — compose moved to Home's bar (owner's call,
            2026-08-26). The tree is marked instead: same five rows, but its
            glyph sits in a coral disc, matching the bar. Marked, not lifted;
            lifting is what made the old centre slot read as an action. */}
        <View style={{ gap: 4 }}>
          {DESTINATIONS.map(({ name, href }) => {
            const config = TABS[name];
            if (config === undefined) return null;

            // Exact match on purpose. With a profile or a post open nothing is
            // highlighted — which is true, and better than implying the tab
            // underneath is where the reader currently is.
            const selected = pathname === href;

            return (
              <Row
                key={href}
                label={t(config.labelKey)}
                icon={config.icon}
                accent={config.accent ?? false}
                tint={selected ? colors.coral.deep : colors.text.secondary}
                background={selected ? colors.coral.light : 'transparent'}
                strokeWidth={selected ? 2.4 : 2}
                accessibilityRole="tab"
                selected={selected}
                open={open}
                onPress={() => router.navigate(href)}
              />
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

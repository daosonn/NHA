import { BlurView } from 'expo-blur';
// expo-router 57 vendors react-navigation; `expo-router/js-tabs` is the
// non-deprecated entry point for the JS tab navigator and its types.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { History, House, Plus, Sparkles, UserRound } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, radius } from '../../theme';
import { Text } from '../ui/text';

/**
 * Sizes at the reference width, scaled from there — see `metrics()`.
 *
 * 390 is the iPhone 14/15 and Pixel width, and the size the mockups are
 * drawn at.
 */
const BASE_WIDTH = 390;
const BASE = {
  /** How far the bar floats above the home indicator. */
  lift: 20,
  height: 68,
  itemHeight: 52,
  icon: 22,
  /** The centre action carries no label, so it is sized as a circle. */
  compose: 50,
  composeIcon: 24,
  label: 10,
};

/** Air either side of the bar, so it reads as floating rather than fitted. */
const SIDE_MARGIN = 16;
/**
 * Past this the bar stops growing. A browser window is not a phone, and a
 * 900px-wide row of five buttons is a toolbar, not a tab bar.
 */
const MAX_WIDTH = 460;

/** Below the reference width nothing shrinks; above it, gently, then stops. */
const MIN_SCALE = 1;
const MAX_SCALE = 1.14;

/**
 * What the bar measures on this screen.
 *
 * It used to be a fixed 294px that hugged its contents, which meant the same
 * absolute bar on every phone — 78% of the width on an SE and 68% on a
 * 15 Pro Max. Identical in points, and visibly meaner on the big screen,
 * which is exactly how it was reported (2026-08-21).
 *
 * Two things fix that together. The bar now **spans the width** it is given,
 * with the four destinations flexing evenly, so it keeps its proportion
 * instead of its pixel count. And everything on it **scales gently** with the
 * screen — capped at 1.14, because a tab bar that grows without limit ends up
 * looking like a remote control. Nothing shrinks below the reference: the
 * small phones were reported as already right, and this must not make them
 * worse to fix a big one.
 */
function metrics(width: number) {
  const barWidth = Math.min(width - SIDE_MARGIN * 2, MAX_WIDTH);
  // Against the **screen**, not against `barWidth` — that is already the
  // screen minus two margins, so the ratio sat near 1 on every phone and the
  // scale never engaged.
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, width / BASE_WIDTH));

  return {
    barWidth,
    lift: Math.round(BASE.lift * scale),
    height: Math.round(BASE.height * scale),
    itemHeight: Math.round(BASE.itemHeight * scale),
    icon: Math.round(BASE.icon * scale),
    compose: Math.round(BASE.compose * scale),
    composeIcon: Math.round(BASE.composeIcon * scale),
    label: Math.round(BASE.label * scale * 10) / 10,
  };
}

type Metrics = ReturnType<typeof metrics>;

type TabConfig = { labelKey: string; icon: LucideIcon };

/**
 * Home · Omoide · + · AI · Profile — the five destinations from the mockups.
 * The family tree is *not* a tab; it is reached from the group strip on Home.
 */
const TABS: Record<string, TabConfig> = {
  index: { labelKey: 'nav.tab.home', icon: House },
  omoide: { labelKey: 'nav.tab.omoide', icon: History },
  ai: { labelKey: 'nav.tab.ai', icon: Sparkles },
  profile: { labelKey: 'nav.tab.profile', icon: UserRound },
};

/** The centre action, still the one filled control on the bar. */
const COMPOSE_ROUTE = 'new';

/**
 * One destination. `flex: 1`, so the four share whatever the bar has left
 * after the compose circle — the row keeps its rhythm at any width without
 * anybody choosing a slot size.
 */
function Slot({
  label,
  icon: Icon,
  selected,
  onPress,
  m,
}: {
  label: string;
  icon: LucideIcon;
  selected: boolean;
  onPress: () => void;
  m: Metrics;
}) {
  const tint = selected ? colors.coral.deep : colors.text.secondary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={{
        flex: 1,
        height: m.itemHeight,
        borderRadius: radius['2xl'],
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        // A soft tinted block behind the whole slot rather than a colour
        // change alone — it survives being looked at quickly, and with the
        // label inside it reads as a selected chip rather than a stray pill.
        backgroundColor: selected ? colors.coral.light : 'transparent',
      }}
    >
      <Icon size={m.icon} color={tint} strokeWidth={selected ? 2.4 : 2} />

      {/* Ellipsises rather than wrapping on the narrowest phones, where
          マイページ and a 5-way split are asking a lot of 320px. */}
      <Text
        weight={selected ? 'semibold' : 'medium'}
        color={tint}
        numberOfLines={1}
        style={{ fontSize: m.label, lineHeight: m.label + 2 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The bottom bar, as a floating pill.
 *
 * **It floats.** It used to be a full-width slab pinned to the bottom edge
 * with a hairline on top, which cuts the page in two. Inset with a radius,
 * the content keeps running underneath and the screen stays one thing.
 *
 * **The labels are back** (2026-08-21, having been removed the same morning).
 * Dropping them was borrowed from apps whose icons everybody learned a decade
 * ago; these are not those icons. `History` for 思い出 and `Sparkles` for the
 * AI tab name nothing anyone can guess — a clock could as easily mean
 * "recent" and a sparkle "highlights" — and this is an app built for families
 * to use together, grandparents included, where an unlabelled glyph is a
 * quiz. Two of five icons being legible is not enough to run a navigation bar
 * on. The words come from `nav.tab.*` rather than `nav.*` because the tab
 * needs a shorter one than the screen header does: プロフィール does not fit
 * in 54px, マイページ does. Visible label and accessibility label are the same
 * string, so somebody using voice control can say what they see.
 *
 * The reference in the mockups puts the viewer's own photograph in the last
 * slot. This does not: tried on 2026-08-21 and reverted the same day. A face
 * among four line drawings reads as a fifth kind of thing rather than a fifth
 * destination. The unread dot went with it; the bell in the header already
 * carries that count, and two places showing the same number is one too many.
 */
export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const m = metrics(width);

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + m.lift,
        alignItems: 'center',
      }}
      // The bar is inset, so the strip either side of it belongs to the page
      // underneath and must stay scrollable.
      pointerEvents="box-none"
    >
      <BlurView
        intensity={30}
        tint="light"
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            width: m.barWidth,
            height: m.height,
            paddingHorizontal: 6,
            borderRadius: radius.full,
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.86)',
          },
          elevation.bottomNav,
        ]}
      >
        {state.routes.map((route, index) => {
          const focused = state.index === index;

          const go = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (route.name === COMPOSE_ROUTE) {
            return (
              <Pressable
                key={route.key}
                onPress={go}
                accessibilityRole="button"
                accessibilityLabel={t('nav.newMoment')}
                style={{
                  width: m.compose,
                  height: m.compose,
                  marginHorizontal: 4,
                  borderRadius: radius.full,
                  backgroundColor: colors.coral.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={m.composeIcon} color={colors.text.white} strokeWidth={2.3} />
              </Pressable>
            );
          }

          const config = TABS[route.name];
          if (config === undefined) return null;

          return (
            <Slot
              key={route.key}
              label={t(config.labelKey)}
              icon={config.icon}
              selected={focused}
              onPress={go}
              m={m}
            />
          );
        })}
      </BlurView>
    </View>
  );
}

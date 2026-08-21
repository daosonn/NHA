import { BlurView } from 'expo-blur';
// expo-router 57 vendors react-navigation; `expo-router/js-tabs` is the
// non-deprecated entry point for the JS tab navigator and its types.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { History, House, Plus, Sparkles, UserRound } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, radius } from '../../theme';

/** How far the bar floats above the home indicator. */
const LIFT = 10;
const BAR_HEIGHT = 58;
const ITEM = 46;

type TabConfig = { labelKey: string; icon: LucideIcon };

/**
 * Home · Omoide · + · AI · Profile — the five destinations from the mockups.
 * The family tree is *not* a tab; it is reached from the group strip on Home.
 */
const TABS: Record<string, TabConfig> = {
  index: { labelKey: 'nav.home', icon: House },
  omoide: { labelKey: 'nav.omoide', icon: History },
  ai: { labelKey: 'nav.ai', icon: Sparkles },
  profile: { labelKey: 'nav.profile', icon: UserRound },
};

/** The centre action, still the one filled control on the bar. */
const COMPOSE_ROUTE = 'new';

/** Every slot is the same square, so the five sit on an even rhythm. */
function Slot({
  label,
  selected,
  onPress,
  children,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{
        width: ITEM,
        height: ITEM,
        borderRadius: radius['3xl'],
        alignItems: 'center',
        justifyContent: 'center',
        // The active slot is a soft square behind the glyph rather than a
        // coloured icon on its own — it survives being looked at quickly,
        // which a tint change on a 22px line drawing does not.
        backgroundColor: selected ? colors.coral.light : 'transparent',
      }}
    >
      {children}
    </Pressable>
  );
}

/**
 * The bottom bar, as a floating pill.
 *
 * Redrawn 2026-08-21 to the reference the user supplied. What changed and why:
 *
 * - **It floats.** It used to be a full-width slab pinned to the bottom edge
 *   with a hairline on top, which cuts the page in two. Inset with a radius,
 *   the content keeps running underneath and the screen stays one thing.
 * - **The labels are gone.** Five words under five glyphs is a lot of
 *   furniture for destinations somebody visits every day; the icons carry it,
 *   and the names survive as accessibility labels — a screen reader still
 *   hears "Home", it is only the eye that stops being told.
 *
 * The reference puts the viewer's own photograph in the last slot. This does
 * not: tried on 2026-08-21 and reverted the same day. A face among four line
 * drawings reads as a fifth kind of thing rather than a fifth destination —
 * the row stops looking like one control. The unread dot went with it; the
 * bell in the header already carries that count, and two places showing the
 * same number is one place too many.
 */
export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + LIFT,
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
            gap: 4,
            height: BAR_HEIGHT,
            paddingHorizontal: 8,
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
                  width: ITEM,
                  height: ITEM,
                  borderRadius: radius.full,
                  backgroundColor: colors.coral.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={22} color={colors.text.white} strokeWidth={2.3} />
              </Pressable>
            );
          }

          const config = TABS[route.name];
          if (config === undefined) return null;

          const Icon = config.icon;
          const tint = focused ? colors.coral.deep : colors.text.secondary;

          return (
            <Slot key={route.key} label={t(config.labelKey)} selected={focused} onPress={go}>
              <Icon size={22} color={tint} strokeWidth={focused ? 2.4 : 2} />
            </Slot>
          );
        })}
      </BlurView>
    </View>
  );
}

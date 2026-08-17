import { BlurView } from 'expo-blur';
// expo-router 57 vendors react-navigation; `expo-router/js-tabs` is the
// non-deprecated entry point for the JS tab navigator and its types.
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { History, House, Plus, Sparkles, UserRound } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation, radius } from '../../theme';
import { Text } from '../ui/text';

const ITEM_WIDTH = 68;
const ITEM_HEIGHT = 56;

type TabConfig = { label: string; icon: LucideIcon };

/**
 * Home · Omoide · + · AI · Profile — the five destinations from the mockups.
 * The family tree is *not* a tab; it is reached from the group strip on Home.
 */
const TABS: Record<string, TabConfig> = {
  index: { label: 'Home', icon: House },
  omoide: { label: 'Omoide', icon: History },
  ai: { label: 'AI', icon: Sparkles },
  profile: { label: 'Profile', icon: UserRound },
};

/** The centre action, raised above the row. */
const COMPOSE_ROUTE = 'new';

function TabItem({
  config,
  focused,
  onPress,
}: {
  config: TabConfig;
  focused: boolean;
  onPress: () => void;
}) {
  const Icon = config.icon;
  const tint = focused ? colors.coral.primary : colors.text.lightMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={config.label}
      style={{
        width: ITEM_WIDTH,
        height: ITEM_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
      }}
    >
      <View
        style={{
          width: 44,
          height: 26,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: focused ? colors.coral.light : 'transparent',
        }}
      >
        <Icon size={20} color={tint} strokeWidth={2} />
      </View>
      <Text
        variant="badge"
        weight={focused ? 'semibold' : 'medium'}
        color={focused ? colors.text.primary : colors.text.lightMuted}
        style={{ letterSpacing: 0.2 }}
      >
        {config.label}
      </Text>
    </Pressable>
  );
}

export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={40}
      tint="light"
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 8,
          paddingBottom: insets.bottom,
          backgroundColor: 'rgba(255,255,255,0.72)',
          borderTopWidth: 1,
          borderTopColor: colors.state.borderDefault,
        },
        elevation.bottomNav,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-around',
        }}
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
              <View
                key={route.key}
                style={{
                  width: ITEM_WIDTH,
                  height: ITEM_HEIGHT,
                  marginTop: -6,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Pressable
                  onPress={go}
                  accessibilityRole="button"
                  accessibilityLabel="New moment"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.full,
                    backgroundColor: colors.coral.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Plus size={22} color={colors.text.white} strokeWidth={2.2} />
                </Pressable>
              </View>
            );
          }

          const config = TABS[route.name];
          if (config === undefined) return null;

          return <TabItem key={route.key} config={config} focused={focused} onPress={go} />;
        })}
      </View>
    </BlurView>
  );
}

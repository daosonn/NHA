import { Network, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, {
  clamp,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, radius } from '../../theme';
import { Avatar } from '../ui/avatar';
import { Text } from '../ui/text';

/**
 * 34 before 2026-09-03, and too small for what this row now does.
 *
 * It was sized when it was a *preview* on Home — three faces saying a family
 * exists. It is the family SWITCHER on the tree screen: the only control that
 * says which tree is on screen and the only way to change it. A 34px target
 * is also under the 44pt minimum for a thing people tap all day.
 */
const AVATAR = 40;
/** Faces sit apart, not tucked under each other (owner's call 2026-09-01 —
 *  covers are photographs now, and an overlapped photo reads as clipped). */
const OVERLAP = 6;
/** Matches the strip fill so the ring reads as a gap, not a stroke. */
const RING = `0 0 0 2px ${colors.background.subtle}`;
/**
 * Which family is on screen — solid `coral.brand`, 2px of it.
 *
 * It was `rgba(240,112,95,0.35)` at 3px, which over a 2px gap ring leaves a
 * ONE pixel line at 35% opacity: the selected face was all but
 * indistinguishable from the six beside it. This is the strip's only state,
 * so it gets a mark that survives being looked at on a phone outdoors.
 */
const RING_ACTIVE = `${RING}, 0 0 0 4px ${colors.coral.brand}`;
/** How far the widest ring reaches outside a face's own box. */
const RING_BLEED = 4;

/** Resting height, and what the row occupies once it has condensed. */
const TRAY = 60;
const TRAY_CONDENSED = 52;
/** 60 × 0.86 ≈ 52, so the scale and the reclaimed height agree. */
const CONDENSED_SCALE = 0.86;
/** How far the page scrolls before the strip has finished condensing. */
export const CONDENSE_DISTANCE = 90;

const CAP = 44;
/** Pointer devices only; this never fires on a touchscreen. */
const HOVER_SCALE = 1.06;
const HOVER_MS = 140;

export type FamilyGroupSummary = {
  id: string;
  name: string;
  /** Ảnh đại diện của gia đình (id Media) — có thì mặt cả nhà thay chữ viết tắt. */
  coverMediaId?: string | null;
};

export type GroupStripProps = {
  groups: FamilyGroupSummary[];
  remainingCount: number;
  onPress?: () => void;
  onAddPress?: () => void;
  /** Hidden on the family tree screen itself, where it would go nowhere. */
  showTreeLink?: boolean;
  /** Which group is being looked at. Falls back to the first face. */
  activeId?: string;
  /**
   * How far the page behind it has scrolled, in pixels. Given by a screen
   * that pins the strip; omitted by one that lets it scroll away, where
   * condensing would be motion for its own sake.
   */
  scrollY?: SharedValue<number>;
  /**
   * Makes each face its own target, so the strip switches groups instead of
   * only opening the tree. Given on the tree screen, where switching is the
   * whole point of the strip; omitted on Home, where the strip is a way in.
   */
  onSelectGroup?: (id: string) => void;
};

/**
 * The way into the family tree, and the family it belongs to.
 *
 * Three attempts on 2026-08-21, worth recording because the first two failed
 * in instructive ways:
 *
 * 1. A 12px `text.muted` word beside a white chevron in a white circle. It
 *    disappeared — muted grey is the colour of every caption on the screen.
 * 2. A white pill with a coral **border**, inside the tray. Border inside
 *    border inside border: a button dropped in a drawer.
 * 3. The pill moved out of the tray onto the page. Now the row read as two
 *    unrelated objects rather than one control.
 *
 * What it is now: one tray again, with the tree link as a **filled** cap at
 * its right end. A fill inside a container is ordinary — a chip in a bar —
 * where a second outline was not. `coral.deep` on `coral.light` is 4.6:1,
 * and no solid coral in this palette can carry white label text at AA
 * (`design-system.md` § Group strip), so the tint is not a compromise here;
 * it is the only readable brand fill the palette has.
 *
 * The real prominence, though, is not colour: **the strip is pinned**. It
 * used to be the first row of the feed and scrolled away on the first flick,
 * which no amount of contrast can fix. It now stays put and condenses to
 * 86% as the feed moves under it, the way a nav bar does — smaller once
 * somebody is reading, never gone.
 *
 * Nothing here may nest: `react-native-web` turns every
 * `accessibilityRole="button"` into a real `<button>`, and a button inside a
 * button swallows the inner press. So the tray's contents are siblings.
 *
 * Sizes grew on 2026-09-03 (owner: the circles looked shaved and the row too
 * small). Two separate faults behind one complaint: the faces were still at
 * the 34px they were given as a Home *preview* rather than as the tree's
 * switcher, and the rings were being clipped by the scroller that keeps a
 * long row reachable — see `RING_BLEED` at the ScrollView.
 */
export function GroupStrip({
  groups,
  remainingCount,
  onPress,
  onAddPress,
  showTreeLink = true,
  activeId,
  scrollY,
  onSelectGroup,
}: GroupStripProps) {
  const { t } = useTranslation();

  const isActive = (group: FamilyGroupSummary, index: number) =>
    activeId === undefined ? index === 0 : group.id === activeId;

  const hover = useSharedValue(0);

  /**
   * 0 at the top of the page, 1 once it has scrolled `CONDENSE_DISTANCE`.
   *
   * A derived value rather than a helper called from each style: Reanimated
   * works out which shared values a worklet depends on by reading the
   * worklet's own body, and `scrollY.value` buried inside a function it
   * merely calls is not reliably seen. Reading it here, once, is.
   */
  const condense = useDerivedValue(() =>
    scrollY === undefined ? 0 : clamp(scrollY.value / CONDENSE_DISTANCE, 0, 1),
  );

  const outerStyle = useAnimatedStyle(() => ({
    height: interpolate(condense.value, [0, 1], [TRAY, TRAY_CONDENSED]),
  }));

  const trayStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(condense.value, [0, 1], [1, CONDENSED_SCALE]) }],
  }));

  const capStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + hover.value * (HOVER_SCALE - 1) }],
  }));

  /**
   * Selectable faces have to be siblings of the strip press target, not
   * children of it: `react-native-web` turns every `accessibilityRole`
   * button into a real `<button>`, and a button inside a button is invalid
   * markup that swallows the inner press.
   */
  const faces = groups.map((group, index) => {
    const ring = isActive(group, index) ? RING_ACTIVE : RING;
    const style = { marginLeft: index === 0 ? 0 : OVERLAP };

    if (onSelectGroup === undefined) {
      return (
        <Avatar
          key={group.id}
          size={AVATAR}
          name={group.name}
          mediaId={group.coverMediaId}
          ring={ring}
          style={style}
        />
      );
    }

    return (
      <Pressable
        key={group.id}
        onPress={() => onSelectGroup(group.id)}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive(group, index) }}
        accessibilityLabel={t('home.switchToGroup', { name: group.name })}
        style={style}
      >
        <Avatar size={AVATAR} name={group.name} mediaId={group.coverMediaId} ring={ring} />
      </Pressable>
    );
  });

  return (
    <Animated.View style={[{ justifyContent: 'center' }, outerStyle]}>
      <Animated.View
        style={[
          {
            height: TRAY,
            borderRadius: radius.full,
            backgroundColor: colors.background.subtle,
            borderWidth: 1,
            borderColor: 'rgba(24,24,27,0.05)',
            paddingLeft: 10,
            paddingRight: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          },
          trayStyle,
        ]}
      >
        {/* Nhiều nhà thì dải mặt CUỘN trong phần co giãn của khay — nút "+"
            và nắp cây đứng ngoài, không bao giờ bị đẩy mất (Sơn dính 16 nhà
            tràn khay, 01/09). flexGrow:0 để khay ngắn khi ít nhà. */}
        {onSelectGroup !== undefined && (
          // Every group renders here (see `toStripGroups` — this is the
          // switcher, not a preview), so the row has no upper bound on width.
          // A plain row overflowed the tray and spilled past the screen edge
          // once a family had enough groups; scrolling keeps every face
          // reachable without growing past the available width.
          // `flexShrink`/`minWidth: 0` let the scroller shrink to fit beside
          // its siblings instead of forcing the tray wider than the screen —
          // react-native-web needs `minWidth: 0` explicitly, the same trap as
          // the icon box in `SideNav`.
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexShrink: 1, minWidth: 0 }}
            // The padding is what stops the faces being SHAVED, and it is not
            // cosmetic breathing room. A ring here is a `boxShadow`, which is
            // painted OUTSIDE the element's own box, and `react-native-web`
            // gives a horizontal ScrollView `overflow-x: auto` with
            // `overflow-y: hidden`. The scroller is only as tall as the 40px
            // faces inside it, so without this the active ring lost its top
            // and bottom edge, and the first and last face lost their outer
            // one — the selected family read as a circle with a flat side.
            contentContainerStyle={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: RING_BLEED,
              paddingHorizontal: RING_BLEED,
            }}
          >
            {faces}
          </ScrollView>
        )}

        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={t('home.openFamilyTree')}
          style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 }}
        >
          {onSelectGroup === undefined && faces}

          {remainingCount > 0 && (
            <View
              style={{
                width: AVATAR,
                height: AVATAR,
                marginLeft: OVERLAP,
                borderRadius: radius.full,
                backgroundColor: colors.background.card,
                boxShadow: RING,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text variant="caption" weight="semibold" color={colors.text.body}>
                {t('home.moreGroups', { count: remainingCount })}
              </Text>
            </View>
          )}
        </Pressable>

        {/* All the slack, in one place, BEFORE the add button.
            It used to sit after it, which left "+" floating in the middle of
            an otherwise empty tray on the tree screen — the faces pack left,
            the add button follows them, and the rest of the pill is dead
            space. Adding a family is not a step in that row; it is the thing
            you reach for when none of the faces is the one you want, so it
            belongs at the far end, against the tray's edge. */}
        <View style={{ flex: 1 }} />

        {/* Coral, like every other "there is room here" mark in the app — the
            empty tree node and the invite sheet's spot both use this dashed
            circle. Grey read as disabled next to faces that are not. */}
        <Pressable
          onPress={onAddPress}
          accessibilityRole="button"
          accessibilityLabel={t('home.newGroup')}
          style={{
            width: AVATAR,
            height: AVATAR,
            borderRadius: radius.full,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.coral.borderSoft,
            backgroundColor: colors.coral.subtle,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={17} color={colors.coral.deep} strokeWidth={2.2} />
        </Pressable>

        {showTreeLink && (
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={t('home.openFamilyTree')}
            // Mouse only, and harmless where there is none: React Native does
            // not fire these on a touchscreen, so no platform check is
            // needed. Growing is the whole cue — the fill cannot darken on
            // hover without dropping the label below 4.5:1.
            onHoverIn={() => {
              hover.value = withTiming(1, { duration: HOVER_MS });
            }}
            onHoverOut={() => {
              hover.value = withTiming(0, { duration: HOVER_MS });
            }}
          >
            <Animated.View
              style={[
                {
                  height: CAP,
                  paddingHorizontal: 14,
                  borderRadius: radius.full,
                  backgroundColor: colors.coral.light,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                },
                capStyle,
              ]}
            >
              <Network size={17} color={colors.coral.deep} strokeWidth={2.3} />

              {/* Truncates rather than pushing the tray wide: "Family tree"
                  is half again the width of 家系図. */}
              <Text variant="body2" weight="semibold" color={colors.coral.deep} numberOfLines={1}>
                {t('home.familyTree')}
              </Text>
            </Animated.View>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

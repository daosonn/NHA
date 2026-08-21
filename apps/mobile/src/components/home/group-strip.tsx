import { ChevronRight, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { colors, radius, spacing } from '../../theme';
import { Avatar } from '../ui/avatar';
import { Text } from '../ui/text';

const AVATAR = 34;
/** Each avatar tucks under the previous one. */
const OVERLAP = -9;
/** Matches the strip fill so the ring reads as a gap, not a stroke. */
const RING = `0 0 0 2px ${colors.background.subtle}`;
const RING_ACTIVE = `${RING}, 0 0 0 3px rgba(240,112,95,0.35)`;

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
   * Makes each face its own target, so the strip switches groups instead of
   * only opening the tree. Given on the tree screen, where switching is the
   * whole point of the strip; omitted on Home, where the strip is a way in.
   */
  onSelectGroup?: (id: string) => void;
};

/**
 * The family switcher that sits above the fold on Home. Tapping it opens the
 * family tree; the dashed circle starts an invite.
 *
 * The strip reads as one button but cannot be one: the invite circle is a
 * second action inside it, and `react-native-web` turns each
 * `accessibilityRole="button"` into a real `<button>`, which may not nest. So
 * it is three sibling press targets, with the trailing one stretched to fill
 * the gap — every pixel except the circle still opens the tree.
 */
export function GroupStrip({
  groups,
  remainingCount,
  onPress,
  onAddPress,
  showTreeLink = true,
  activeId,
  onSelectGroup,
}: GroupStripProps) {
  const { t } = useTranslation();

  const isActive = (group: FamilyGroupSummary, index: number) =>
    activeId === undefined ? index === 0 : group.id === activeId;

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
          avatarKey={group.coverMediaId}
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
        <Avatar size={AVATAR} name={group.name} avatarKey={group.coverMediaId} ring={ring} />
      </Pressable>
    );
  });

  return (
    <View
      style={{
        height: 52,
        borderRadius: radius.full,
        backgroundColor: colors.background.subtle,
        borderWidth: 1,
        borderColor: 'rgba(24,24,27,0.05)',
        paddingLeft: 10,
        paddingRight: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {onSelectGroup !== undefined && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>{faces}</View>
      )}

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('home.openFamilyTree')}
        style={{ flexDirection: 'row', alignItems: 'center' }}
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
        <Plus size={15} color={colors.coral.deep} strokeWidth={2.2} />
      </Pressable>

      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('home.openFamilyTree')}
        style={{
          flex: 1,
          height: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
        }}
      >
        {showTreeLink && (
          <>
            <Text variant="caption" weight="medium" color={colors.text.muted}>
              {t('home.familyTree')}
            </Text>

            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.full,
                backgroundColor: colors.background.card,
                boxShadow: '0 1px 3px rgba(24,24,27,0.08)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronRight size={16} color={colors.coral.brand} strokeWidth={2.2} />
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
}

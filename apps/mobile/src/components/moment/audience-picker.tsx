import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { colors, radius } from '../../theme';
import type { AudienceGroup } from '../../fixtures/moment';
import { Avatar } from '../ui/avatar';
import { Text } from '../ui/text';

const CIRCLE = 64;
const ITEM_WIDTH = 76;

/** Two rings: the page colour cuts a gap, the coral one reads as "on". */
const RING_ON = `0 0 0 2px ${colors.background.page}, 0 0 0 4px ${colors.coral.brand}`;
const RING_OFF = `0 0 0 2px ${colors.background.page}, 0 0 0 4px ${colors.state.disabledBorder}`;

export type AudiencePickerProps = {
  groups: AudienceGroup[];
  /** Ids that will receive the post. */
  selected: string[];
  onToggle: (group: AudienceGroup) => void;
};

/**
 * Which families a moment reaches — one `PostFamily` row per lit circle.
 *
 * Everything starts lit and tapping dims: the destructive direction is the
 * one that needs the deliberate action, and a dimmed circle stays visible so
 * you can see what you excluded rather than having to remember it.
 */
export function AudiencePicker({ groups, selected, onToggle }: AudiencePickerProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, paddingVertical: 6 }}
    >
      {groups.map((group) => {
        const on = selected.includes(group.id);

        return (
          <Pressable
            key={group.id}
            onPress={() => onToggle(group)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={t('moment.audienceOption', {
              name: group.name,
              count: group.memberCount,
            })}
            style={{ width: ITEM_WIDTH, alignItems: 'center', gap: 8 }}
          >
            <View style={{ opacity: on ? 1 : 0.42 }}>
              {/* Real photos will also want desaturating when off; the
                  placeholder stripes are already grey, so opacity carries it
                  for now. */}
              <Avatar size={CIRCLE} tone={group.tone} ring={on ? RING_ON : RING_OFF} />

              {on && (
                <View
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 22,
                    height: 22,
                    borderRadius: radius.full,
                    backgroundColor: colors.coral.primary,
                    borderWidth: 2,
                    borderColor: colors.background.page,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={13} color={colors.text.white} strokeWidth={2.6} />
                </View>
              )}
            </View>

            <Text
              variant="caption"
              weight={on ? 'semibold' : 'medium'}
              color={on ? colors.text.primary : colors.text.muted}
              numberOfLines={1}
              style={{ textAlign: 'center' }}
            >
              {group.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

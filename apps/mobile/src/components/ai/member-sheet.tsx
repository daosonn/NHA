import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { FamilyMemberSummary } from '../../lib/api';
import { colors, radius } from '../../theme';
import { Avatar } from '../ui/avatar';
import { Text } from '../ui/text';
import { Sheet } from './sheet';

export type MemberSheetProps = {
  visible: boolean;
  onClose: () => void;
  members: FamilyMemberSummary[];
  selectedId: string | null;
  onSelect: (member: FamilyMemberSummary) => void;
};

/** The picker behind the FOR / To rows (11a, 11e, 11h) — one person per row. */
export function MemberSheet({ visible, onClose, members, selectedId, onSelect }: MemberSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet visible={visible} onClose={onClose} title={t('ai.memberSheet.title')}>
      {members.map((m) => {
        const selected = m.id === selectedId;
        return (
          <Pressable
            key={m.id}
            onPress={() => {
              onSelect(m);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 11,
              padding: 10,
              borderRadius: radius['2xl'],
              backgroundColor: selected ? colors.coral.soft : pressed ? colors.background.subtle : 'transparent',
            })}
          >
            <Avatar size={38} name={m.displayName} mediaId={m.avatarKey} />
            <Text variant="body2" weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
              {m.displayName}
            </Text>
            {selected && (
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: radius.full,
                  backgroundColor: colors.coral.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={13} color={colors.text.white} strokeWidth={3} />
              </View>
            )}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

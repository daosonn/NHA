import { Check, UserRoundPlus } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import type { TaggableMember } from '../../features/family/use-taggable-members';
import { colors, radius, spacing } from '../../theme';
import { Text } from '../ui/text';

export type MemberTagPickerProps = {
  members: TaggableMember[];
  /** `FamilyMember.id`s, which is what `taggedMemberIds` takes. */
  selected: string[];
  onToggle: (memberId: string) => void;
};

/**
 * Who is in this moment.
 *
 * This is the half that was missing. A member's Album is built from
 * `PostMemberTag` — the moments they appear in — and nothing in the app ever
 * wrote one, so every profile's Album was permanently empty however many
 * photos the family posted. The grid was reading a field the composer never
 * filled in.
 *
 * Chips rather than a sheet: on a phone the whole family fits in two rows,
 * and a picker you have to open is a picker nobody opens. Nothing is
 * pre-selected — tagging says a person is *in* the photograph, and guessing
 * that is how people end up in pictures they were never in.
 *
 * Empty is a fine answer. A moment with nobody named still reaches the family
 * feed; it just does not land in anybody's Album.
 *
 * Người đã gán thẻ GHIM LÊN ĐẦU dải (Sơn chốt 26/08): gia đình đông thì chip
 * đang chọn dễ trôi ra ngoài màn — người soạn phải kéo mới biết mình đã tag ai.
 * Phần chưa chọn giữ nguyên thứ tự gốc. Bấm chọn thêm → chip nhảy lên đầu và
 * dải tự cuộn về đầu để thấy ngay; bỏ chọn thì chip về lại chỗ cũ.
 */
export function MemberTagPicker({ members, selected, onToggle }: MemberTagPickerProps) {
  const { t } = useTranslation();
  const scroll = useRef<ScrollView>(null);
  const prevCount = useRef(selected.length);

  const ordered = useMemo(() => {
    if (selected.length === 0) return members;
    const picked = members.filter((m) => selected.includes(m.id));
    const rest = members.filter((m) => !selected.includes(m.id));
    return [...picked, ...rest];
  }, [members, selected]);

  // Vừa chọn THÊM một người → đưa dải về đầu để chip mới ghim lọt vào tầm nhìn.
  // Bỏ chọn thì không cuộn: người dùng đang nhìn chỗ họ vừa bấm.
  useEffect(() => {
    if (selected.length > prevCount.current) {
      scroll.current?.scrollTo({ x: 0, animated: true });
    }
    prevCount.current = selected.length;
  }, [selected.length]);

  if (members.length === 0) return null;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <UserRoundPlus size={15} color={colors.text.muted} strokeWidth={2.2} />
        <Text variant="caption" weight="semibold" color={colors.text.secondary}>
          {t('moment.tagHeading')}
        </Text>
      </View>

      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7, paddingRight: spacing.xl }}
      >
        {ordered.map((member) => {
          const active = selected.includes(member.id);

          return (
            <Pressable
              key={member.id}
              onPress={() => onToggle(member.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={t('moment.tagMember', { name: member.displayName })}
              style={{
                height: 32,
                paddingLeft: active ? 9 : 12,
                paddingRight: 12,
                borderRadius: radius.full,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: active ? colors.coral.light : colors.background.card,
                boxShadow: active
                  ? `inset 0 0 0 1.5px ${colors.coral.border}`
                  : `inset 0 0 0 1px ${colors.state.borderDefault}`,
              }}
            >
              {active && <Check size={13} color={colors.coral.deep} strokeWidth={2.6} />}

              <Text
                variant="caption"
                weight={active ? 'semibold' : 'medium'}
                color={active ? colors.coral.deep : colors.text.secondary}
              >
                {member.isViewer ? t('moment.tagYou') : member.displayName}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text variant="badge" color={colors.text.subtle}>
        {t('moment.tagHint')}
      </Text>
    </View>
  );
}

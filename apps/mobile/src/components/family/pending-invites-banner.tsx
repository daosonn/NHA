import { useRouter } from 'expo-router';
import { ChevronRight, MailOpen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useMyInvitations } from '../../features/family/use-invitations';
import { colors, radius } from '../../theme';
import { ContentColumn } from '../layout/content-column';
import { Text } from '../ui/text';

/**
 * "Somebody invited you" — shown on Home only while an invitation is waiting.
 *
 * It is pinned, which the tree's floating banner was not allowed to be
 * (removed 2026-08-26 for covering the map). The difference is that this one
 * is absent almost always: an invitation is a time-limited offer addressed to
 * you, and it expires in seven days whether or not you scrolled far enough to
 * find it. Nothing here is permanent furniture.
 *
 * It matters most to an account with no family at all, where Home otherwise
 * offers only "start a family" — telling somebody to found a household they
 * have just been invited into is the wrong instruction.
 */
export function PendingInvitesBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data } = useMyInvitations();

  const count = data?.length ?? 0;
  if (count === 0) return null;

  const first = data?.[0];

  // paddingTop: thiếu nó card dính sát mép dưới header (Đạt, 2026-08-27).
  return (
    <ContentColumn style={{ paddingTop: 12, paddingBottom: 10 }}>
      <Pressable
        onPress={() => router.push('/family/my-invitations')}
        accessibilityRole="button"
        accessibilityLabel={t('invite.mine.bannerAction', { count })}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: radius['3xl'],
          backgroundColor: pressed ? colors.coral.light : colors.coral.soft,
          borderWidth: 1,
          borderColor: colors.coral.borderSoft,
        })}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.full,
            backgroundColor: colors.background.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MailOpen size={17} color={colors.coral.deep} strokeWidth={2.1} />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body2" weight="semibold" color={colors.coral.deep} numberOfLines={1}>
            {t('invite.mine.bannerTitle', { count })}
          </Text>
          {/* One name reads warmer than a number, and with a single invitation
              waiting the number says nothing the name does not. */}
          <Text variant="caption" color={colors.text.body} numberOfLines={1}>
            {count === 1 && first !== undefined
              ? t('invite.mine.bannerOne', { name: first.inviterName })
              : t('invite.mine.bannerMany', { count })}
          </Text>
        </View>

        <ChevronRight size={17} color={colors.coral.brand} strokeWidth={2.2} />
      </Pressable>
    </ContentColumn>
  );
}

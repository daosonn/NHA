import { useRouter } from 'expo-router';
import { ChevronRight, Clock, MailOpen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Text } from '../../src/components/ui/text';
import { invitedAsKey } from '../../src/features/family/kinship';
import { useMyInvitations } from '../../src/features/family/use-invitations';
import type { InvitationSummary } from '../../src/lib/api';
import { daysUntil } from '../../src/lib/date';
import { colors, radius } from '../../src/theme';

/**
 * Invitations somebody sent to me — the other side of `family/invitations.tsx`,
 * which lists the ones this family sent out.
 *
 * Only invitations addressed to an account appear: a code handed over by hand
 * names nobody, so there is no "me" for it to match. Tapping a row opens the
 * existing `/invite/[code]` page rather than accepting here, so the invitee
 * sees who invited them and where they land before committing — the same
 * screen someone arriving from a shared link gets, not a second, thinner
 * version of it.
 */
function InviteRow({ invite, onPress }: { invite: InvitationSummary; onPress: () => void }) {
  const { t } = useTranslation();
  const left = daysUntil(invite.expiresAt);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('invite.mine.open', {
        family: invite.inviterName,
      })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: radius['3xl'],
        backgroundColor: pressed ? colors.background.subtle : colors.background.card,
        borderWidth: 1,
        borderColor: colors.coral.borderSoft,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.full,
          backgroundColor: colors.coral.light,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MailOpen size={18} color={colors.coral.deep} strokeWidth={2.1} />
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="body1" weight="semibold" numberOfLines={1}>
          {t('invite.mine.from', { name: invite.inviterName })}
        </Text>
        <Text variant="caption" color={colors.text.muted} numberOfLines={1}>
          {t(invitedAsKey(invite.kinshipKey, invite.relationshipType))}
        </Text>

        {/* The deadline is the one thing that changes on its own, so it is
            named rather than discovered when the link stops working. */}
        {left !== null && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Clock size={12} color={colors.text.subtle} strokeWidth={2} />
            <Text variant="caption" color={colors.text.subtle}>
              {t('invite.mine.expiresIn', { count: left })}
            </Text>
          </View>
        )}
      </View>

      <ChevronRight size={18} color={colors.text.lightMuted} strokeWidth={2} />
    </Pressable>
  );
}

export default function MyInvitationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const list = useMyInvitations();

  const invites = list.data ?? [];

  return (
    <View className="flex-1 bg-page">
      <AppHeader left={<BackButton />} center={<ScreenTitle title={t('invite.mine.title')} />} />

      {list.isPending ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.coral.brand} />
        </View>
      ) : (
        <ScrollView
          // The column, not a wrapper: the scrollbar stays at the window edge
          // where a desktop reader expects it, only the content is held in.
          contentContainerStyle={[contentColumn, { paddingVertical: 16, gap: 10 }]}
          showsVerticalScrollIndicator={false}
        >
          {invites.length === 0 ? (
            <EmptyState
              title={t('invite.mine.emptyTitle')}
              description={t('invite.mine.emptyBody')}
              cat
              renderIcon={({ size, color }) => (
                <MailOpen size={size} color={color} strokeWidth={1.8} />
              )}
            />
          ) : (
            invites.map((invite) => (
              <InviteRow
                key={invite.id}
                invite={invite}
                onPress={() =>
                  router.push({ pathname: '/invite/[code]', params: { code: invite.code } })
                }
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

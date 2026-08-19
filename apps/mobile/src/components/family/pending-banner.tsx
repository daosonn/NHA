import { Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { invitedAsKey } from '../../features/family/kinship';
import type { InvitationSummary } from '../../lib/api';
import { daysUntil, relativeTime } from '../../lib/date';
import { colors, elevation, radius } from '../../theme';
import { Text } from '../ui/text';

export type PendingBannerProps = {
  invite: InvitationSummary;
  /** How many others are also outstanding, so one banner can stand for all. */
  otherCount?: number;
  onResend?: () => void;
  resending?: boolean;
};

/**
 * Sits over the canvas while an invitation is outstanding.
 *
 * One banner, not one per invitation: the tree is the thing being looked at,
 * and a stack of these would bury it. The newest is named and the rest are
 * counted, which is enough to know something is waiting.
 *
 * Inset from the right rather than given a fixed width, so it never grows
 * under the zoom controls on a narrow handset.
 */
export function PendingBanner({
  invite,
  otherCount = 0,
  onResend,
  resending = false,
}: PendingBannerProps) {
  const { t } = useTranslation();

  const role = t(invitedAsKey(invite.kinshipKey, invite.relationshipType));
  const sent = relativeTime(invite.createdAt);
  const left = daysUntil(invite.expiresAt);

  // Two facts, and which one matters changes with time: freshly sent, "2 days
  // ago" is the answer; near the deadline, how long is left is. Both are shown
  // when both are known, because the sender is deciding whether to nudge.
  const meta = [
    t('family.invitedAs', { role }),
    sent === null ? null : t(sent.key, { count: sent.count }),
    left === null ? null : t('family.invitedExpires', { count: left }),
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

  return (
    <View
      style={[
        {
          position: 'absolute',
          left: 12,
          top: 12,
          right: 64,
          borderRadius: radius.xl,
          backgroundColor: 'rgba(255,255,255,0.95)',
          paddingVertical: 10,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        elevation.card,
      ]}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.full,
          backgroundColor: colors.coral.light,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Clock size={17} color={colors.coral.dark} strokeWidth={2} />
      </View>

      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="caption" weight="semibold" numberOfLines={1}>
          {otherCount > 0
            ? t('family.waitingForMore', { name: invite.name, count: otherCount })
            : t('family.waitingFor', { name: invite.name })}
        </Text>
        <Text variant="badge" color={colors.text.subtle} numberOfLines={1}>
          {meta}
        </Text>
      </View>

      {resending ? (
        <ActivityIndicator size="small" color={colors.coral.brand} />
      ) : (
        <Pressable
          onPress={onResend}
          accessibilityRole="button"
          accessibilityLabel={t('family.resendFor', { name: invite.name })}
          hitSlop={8}
        >
          <Text variant="badge" weight="semibold" color={colors.coral.deep}>
            {t('family.resend')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

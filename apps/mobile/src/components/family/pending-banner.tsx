import { Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { colors, elevation, radius } from '../../theme';
import type { PendingInvite } from '../../fixtures/invite';
import { Text } from '../ui/text';

export type PendingBannerProps = {
  invite: PendingInvite;
  onResend?: () => void;
};

/**
 * Sits over the canvas while an invite is outstanding.
 *
 * Inset from the right rather than given a fixed width, so it never grows
 * under the zoom controls on a narrow handset.
 */
export function PendingBanner({ invite, onResend }: PendingBannerProps) {
  const { t } = useTranslation();

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
          {t('family.waitingFor', { name: invite.name })}
        </Text>
        <Text variant="badge" color={colors.text.subtle} numberOfLines={1}>
          {t('family.invitedAs', { role: invite.role, sent: invite.sentAgo })}
        </Text>
      </View>

      <Pressable onPress={onResend} accessibilityRole="button" hitSlop={8}>
        <Text variant="badge" weight="semibold" color={colors.coral.deep}>
          {t('family.resend')}
        </Text>
      </Pressable>
    </View>
  );
}

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, History, UserRound, UsersRound, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { InvitePreview } from '../../src/components/family/invite-preview';
import { Avatar } from '../../src/components/ui/avatar';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Text } from '../../src/components/ui/text';
import { invitation } from '../../src/fixtures/invite';
import { colors, radius, spacing } from '../../src/theme';

const HERO_AVATAR = 60;

function Fact({
  renderIcon,
  children,
}: {
  renderIcon: (props: { size: number; color: string }) => React.ReactNode;
  children: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: radius.full,
          backgroundColor: colors.coral.light,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {renderIcon({ size: 14, color: colors.coral.dark })}
      </View>
      <Text variant="body2" color={colors.text.secondary} style={{ flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

/**
 * The other side of the invite: what someone sees when the link opens.
 *
 * The spot is already reserved by the time this screen exists, so the page
 * can be specific — who invited you, as what, and exactly where you land —
 * rather than asking a stranger to trust a bare "join this family" button.
 *
 * This is the in-app version. Someone without the app yet needs a web page,
 * which waits on `apps/web` getting a role.
 */
export default function InvitationScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={8}
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.full,
              backgroundColor: colors.background.subtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={17} color={colors.text.secondary} strokeWidth={2} />
          </Pressable>
        }
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {t('invite.page.title')}
          </Text>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Avatar size={HERO_AVATAR} tone="light" ring={`0 0 0 3px ${colors.background.page}`} />
            <BrandMark size={34} />
            <View
              style={{
                width: HERO_AVATAR,
                height: HERO_AVATAR,
                borderRadius: radius.full,
                borderWidth: 1.8,
                borderStyle: 'dashed',
                borderColor: colors.coral.border,
                backgroundColor: colors.coral.subtle,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserRound size={24} color={colors.coral.dark} strokeWidth={2} />
            </View>
          </View>

          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text variant="h1" weight="bold" style={{ letterSpacing: -0.5, textAlign: 'center' }}>
              {t('invite.page.headline', {
                inviter: invitation.inviterName,
                family: invitation.familyName,
              })}
            </Text>

            <Text variant="body2" color={colors.text.muted} style={{ textAlign: 'center' }}>
              {t('invite.page.subtitleBefore')}
              <Text variant="body2" weight="semibold" color={colors.text.primary}>
                {invitation.role}
              </Text>
              {t('invite.page.subtitleAfter')}
            </Text>
          </View>
        </View>

        <InvitePreview invitation={invitation} />

        <Card padding={16} style={{ gap: 10 }}>
          <Fact renderIcon={(props) => <UsersRound {...props} strokeWidth={2.2} />}>
            {t('invite.page.membersJoined', { count: invitation.memberCount })}
          </Fact>
          <Fact renderIcon={(props) => <History {...props} strokeWidth={2.2} />}>
            {t('invite.page.momentsWaiting', { count: invitation.momentCount })}
          </Fact>
          <Fact renderIcon={(props) => <Check {...props} strokeWidth={2.2} />}>
            {t('invite.page.privacy')}
          </Fact>
        </Card>

        <View style={{ gap: 10 }}>
          <Button label={t('invite.page.join')} size="large" fullWidth />
          <Button
            label={t('invite.page.notNow')}
            variant="ghost"
            size="medium"
            fullWidth
            onPress={() => router.back()}
          />

          <Text variant="badge" color={colors.text.subtle} style={{ textAlign: 'center' }}>
            {t('invite.page.finePrint', { code: code ?? invitation.code })}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

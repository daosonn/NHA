import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, History, TriangleAlert, UserRound, UsersRound, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { InvitePreview } from '../../src/components/family/invite-preview';
import { AppHeader } from '../../src/components/layout/app-header';
import { ScreenTitle } from '../../src/components/layout/header-slots';
import { Avatar } from '../../src/components/ui/avatar';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Text } from '../../src/components/ui/text';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { invitedAsKey } from '../../src/features/family/kinship';
import { setPendingInvite } from '../../src/features/family/pending-invite';
import {
  useAcceptInvitation,
  useInvitationPreview,
} from '../../src/features/family/use-invitations';
import { ApiError } from '../../src/lib/api';
import { daysUntil } from '../../src/lib/date';
import { colors, radius, spacing } from '../../src/theme';
import { safeBack } from '../../src/lib/back';

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
 * The other side of the invite: what somebody sees when the code opens.
 *
 * The one screen in the app that has to work signed out — `GET /invitations/:code`
 * is the API's only public route, precisely so the page can make its case
 * before asking anyone to register. Accepting is what needs an account, and
 * the button says which of the two it is about to do.
 *
 * The spot is already reserved by the time this exists, so the page can be
 * specific: who invited you, as what, and exactly where you land, rather than
 * asking a stranger to trust a bare "join this family" button.
 */
export default function InvitationScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { status } = useSession();
  const { setFamilyId } = useActiveFamily();

  const preview = useInvitationPreview(code ?? null);
  const accept = useAcceptInvitation();

  const close = () => {
    // Reached from a share link as often as from inside the app, and then
    // there is nothing behind it to go back to.
    safeBack(router);
  };

  const join = () => {
    if (code === undefined) return;

    if (status !== 'authenticated') {
      // Left where Home will find it rather than carried as a route param:
      // the auth group redirects to Home the instant a session exists, and a
      // return navigation fired on that same tick loses the race.
      setPendingInvite(code);
      router.push('/sign-up');
      return;
    }

    accept.mutate(code, {
      onSuccess: (result) => {
        setFamilyId(result.familyId);
        router.replace('/');
      },
    });
  };

  const header = (
    <AppHeader
      left={
        <Pressable
          onPress={close}
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
      center={<ScreenTitle title={t('invite.page.title')} />}
    />
  );

  if (preview.isPending) {
    return (
      <View className="flex-1 bg-page">
        {header}
        <View style={{ paddingTop: 48, alignItems: 'center' }}>
          <ActivityIndicator color={colors.coral.primary} />
        </View>
      </View>
    );
  }

  if (preview.isError || preview.data === undefined) {
    return (
      <View className="flex-1 bg-page">
        {header}
        <EmptyState
          renderIcon={(props) => <TriangleAlert {...props} strokeWidth={2} />}
          title={t(deadInviteKey(preview.error))}
          description={t('invite.page.deadBody')}
          actionLabel={t('invite.page.notNow')}
          onActionPress={close}
        />
      </View>
    );
  }

  const invitation = preview.data;
  const role = t(invitedAsKey(invitation.kinshipKey, invitation.relationshipType));
  const left = daysUntil(invitation.expiresAt);

  return (
    <View className="flex-1 bg-page">
      {header}

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Avatar
              size={HERO_AVATAR}
              name={invitation.inviterName}
              ring={`0 0 0 3px ${colors.background.page}`}
            />
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
                {role}
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
          {accept.error !== null && (
            <Text
              variant="caption"
              color={colors.themes.destructive.text}
              accessibilityRole="alert"
              style={{ textAlign: 'center' }}
            >
              {t(acceptErrorKey(accept.error))}
            </Text>
          )}

          {/* Signed out, this is a registration button wearing the invite's
              clothes. Saying so beats a sign-up screen appearing out of
              nowhere after a tap that promised to join a family. */}
          <Button
            label={
              status === 'authenticated' ? t('invite.page.join') : t('invite.page.joinSignedOut')
            }
            size="large"
            fullWidth
            loading={accept.isPending}
            onPress={join}
          />
          <Button
            label={t('invite.page.notNow')}
            variant="ghost"
            size="medium"
            fullWidth
            onPress={close}
          />

          <Text variant="badge" color={colors.text.subtle} style={{ textAlign: 'center' }}>
            {left === null
              ? t('invite.page.finePrint', { code: invitation.code })
              : t('invite.page.finePrintExpiry', { code: invitation.code, count: left })}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Why the code did not open anything.
 *
 * The server answers 404 for a code that never existed *and* for one that was
 * cancelled or has lapsed, which is the right call — telling a stranger
 * "that code was real until Tuesday" leaks more than it helps. The screen
 * therefore cannot be more specific either, and says so in one line rather
 * than guessing.
 */
function deadInviteKey(error: unknown): string {
  if (error instanceof ApiError && error.isOffline) return 'errors.offline';
  return 'invite.page.dead';
}

function acceptErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'errors.generic';
  if (error.isOffline) return 'errors.offline';
  // The spot was taken, or this account is already in the family.
  if (error.status === 409) return 'invite.page.errors.alreadyMember';
  if (error.status === 404 || error.status === 410) return 'invite.page.dead';
  return 'errors.generic';
}

import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { SettingsButton } from '../../src/components/layout/header-slots';
import { MemoUndoToast } from '../../src/components/member/memo-undo-toast';
import { ProfileBody } from '../../src/components/member/profile-body';
import { Text } from '../../src/components/ui/text';
import { useSession } from '../../src/features/auth/session';
import { withProfileDetail } from '../../src/features/member/profile-overlay';
import { useMyProfile } from '../../src/features/member/use-profile';
import { viewerProfile } from '../../src/fixtures/member';
import { colors, spacing } from '../../src/theme';

/** Clears the bottom nav (56pt plus the home indicator). */
const BOTTOM_INSET = 120;

/**
 * Your own Life Profile.
 *
 * Deliberately the same screen everyone else sees of you — what you write
 * here is what your family reads. Account settings live behind the gear
 * rather than mixed into the profile, so the two never get confused.
 */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useSession();

  // Name, bio, interests and dates come from the server; the timeline and the
  // gallery are still fixtures, so the two are merged rather than swapped.
  const { data } = useMyProfile();
  const profile = withProfileDetail(viewerProfile, data, user?.id ?? null, 'self');

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        center={
          <Text
            variant="subtitle"
            weight="bold"
            style={{ letterSpacing: -0.2, color: colors.coral.primary }}
          >
            {t('nav.profile')}
          </Text>
        }
        right={<SettingsButton onPress={() => router.push('/settings')} />}
        paddingRight={spacing.lg}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: BOTTOM_INSET }}
        showsVerticalScrollIndicator={false}
      >
        <ProfileBody
          profile={profile}
          onEdit={() => router.push('/profile/edit')}
          onAddMemo={() =>
            router.push({ pathname: '/memo/edit', params: { memberId: viewerProfile.id } })
          }
          onOpenMemo={(memo) =>
            router.push({
              pathname: '/memo/[id]',
              params: { id: memo.id, memberId: viewerProfile.id },
            })
          }
          onEditMemo={(memo) =>
            router.push({
              pathname: '/memo/edit',
              params: { id: memo.id, memberId: viewerProfile.id },
            })
          }
        />
      </ScrollView>

      {/* Above the bottom nav, not under it. */}
      <MemoUndoToast memberId={viewerProfile.id} bottom={BOTTOM_INSET} />
    </View>
  );
}

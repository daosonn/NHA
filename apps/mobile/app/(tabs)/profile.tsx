import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { ScreenTitle, SettingsButton } from '../../src/components/layout/header-slots';
import { ProfileBody } from '../../src/components/member/profile-body';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useFamilies } from '../../src/features/family/use-families';
import { useFamilyTree } from '../../src/features/family/use-family-tree';
import { toMemberProfile } from '../../src/features/member/member-profile';
import { useMyProfile } from '../../src/features/member/use-profile';
import { spacing } from '../../src/theme';

/** Clears the bottom nav (56pt plus the home indicator). */
const BOTTOM_INSET = 120;

/**
 * Your own Life Profile.
 *
 * Deliberately the same screen everyone else sees of you — what you write
 * here is what your family reads. Account settings live behind the gear
 * rather than mixed into the profile, so the two never get confused.
 *
 * Which family is on screen still matters even though the profile itself is
 * global: notes, moments and the family's own name are all read through one.
 */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useSession();
  const { familyId } = useActiveFamily();

  const { data: detail } = useMyProfile();
  const { data: families } = useFamilies();
  const { data: tree } = useFamilyTree(familyId);

  const member = tree?.members.find((row) => row.userId === user?.id);
  const memberId = member?.id ?? null;

  const profile = toMemberProfile({
    detail,
    member,
    tree,
    // Your own page never shows a relation word: "you, in relation to you"
    // is not a thing anybody needs told.
    viewerMemberId: memberId,
    viewerUserId: user?.id ?? null,
    familyName: families?.find((family) => family.id === familyId)?.name ?? null,
    fallbackName: user?.name,
  });

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        center={<ScreenTitle title={t('nav.profile')} />}
        right={<SettingsButton onPress={() => router.push('/settings')} />}
        paddingRight={spacing.lg}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: BOTTOM_INSET }}
        showsVerticalScrollIndicator={false}
      >
        <ProfileBody
          profile={profile}
          familyId={familyId}
          memberId={memberId}
          ownProfile
          onEdit={() => router.push('/profile/edit')}
          onAddMemo={() =>
            familyId === null || memberId === null
              ? undefined
              : router.push({ pathname: '/memo/edit', params: { familyId, memberId } })
          }
          onOpenMemo={(memo) => router.push({ pathname: '/memo/[id]', params: { id: memo.id } })}
          onEditMemo={(memo) => router.push({ pathname: '/memo/edit', params: { id: memo.id } })}
          onOpenMoment={(postId) => router.push({ pathname: '/post/[id]', params: { id: postId } })}
        />
      </ScrollView>
    </View>
  );
}

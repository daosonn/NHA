import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import {
  BackButton,
  NotificationBell,
  ScreenTitle,
} from '../../src/components/layout/header-slots';
import { ProfileBody } from '../../src/components/member/profile-body';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useFamilies } from '../../src/features/family/use-families';
import { useFamilyTree } from '../../src/features/family/use-family-tree';
import { toMemberProfile } from '../../src/features/member/member-profile';
import { useMemberProfile } from '../../src/features/member/use-profile';
import { spacing } from '../../src/theme';
import { goBack } from '../../src/lib/navigation';

/**
 * The Life Profile — the centre of the product.
 *
 * One profile per person, global across every family they belong to; the
 * relation word and the name a placeholder goes by are the two things scoped
 * to the family you arrived from, and both come out of the tree rather than
 * out of the profile.
 */
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const { familyId } = useActiveFamily();

  const { data: detail } = useMemberProfile(familyId, id);
  const { data: tree } = useFamilyTree(familyId);
  const { data: families } = useFamilies();

  const profile = toMemberProfile({
    detail,
    member: tree?.members.find((row) => row.id === id),
    tree,
    viewerMemberId: tree?.members.find((row) => row.userId === user?.id)?.id ?? null,
    viewerUserId: user?.id ?? null,
    familyName: families?.find((family) => family.id === familyId)?.name ?? null,
  });

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => goBack(router)} />}
        center={<ScreenTitle title={profile.displayName} />}
        right={<NotificationBell />}
        paddingRight={spacing.lg}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <ProfileBody
          profile={profile}
          familyId={familyId}
          memberId={id}
          onEdit={() =>
            familyId === null
              ? undefined
              : router.push({
                  pathname: '/profile/edit',
                  params: { familyId, memberId: id },
                })
          }
          onAddMemo={() =>
            familyId === null
              ? undefined
              : router.push({ pathname: '/memo/edit', params: { familyId, memberId: id } })
          }
          onOpenMemo={(memo) => router.push({ pathname: '/memo/[id]', params: { id: memo.id } })}
          onEditMemo={(memo) => router.push({ pathname: '/memo/edit', params: { id: memo.id } })}
          onOpenMoment={(postId) => router.push({ pathname: '/post/[id]', params: { id: postId } })}
        />
      </ScrollView>
    </View>
  );
}

import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton } from '../../src/components/layout/header-slots';
import { MemoUndoToast } from '../../src/components/member/memo-undo-toast';
import { ProfileBody } from '../../src/components/member/profile-body';
import { Text } from '../../src/components/ui/text';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { withProfileDetail } from '../../src/features/member/profile-overlay';
import { useMemberProfile } from '../../src/features/member/use-profile';
import { getMemberProfile } from '../../src/fixtures/member';

/**
 * The Life Profile — the centre of the product.
 *
 * One profile per person, global across every family they belong to; only the
 * relation shown in the hero is scoped to the family you arrived from.
 */
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const { familyId } = useActiveFamily();

  const { data } = useMemberProfile(familyId, id);
  const profile = withProfileDetail(getMemberProfile(id), data, user?.id ?? null, 'locked');

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {profile.displayName}
          </Text>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <ProfileBody
          profile={profile}
          onEdit={() =>
            familyId === null
              ? undefined
              : router.push({
                  pathname: '/profile/edit',
                  params: { familyId, memberId: id },
                })
          }
          onAddMemo={() =>
            router.push({ pathname: '/memo/edit', params: { memberId: profile.id } })
          }
          onOpenMemo={(memo) =>
            router.push({ pathname: '/memo/[id]', params: { id: memo.id, memberId: profile.id } })
          }
          onEditMemo={(memo) =>
            router.push({ pathname: '/memo/edit', params: { id: memo.id, memberId: profile.id } })
          }
        />
      </ScrollView>

      <MemoUndoToast memberId={profile.id} />
    </View>
  );
}

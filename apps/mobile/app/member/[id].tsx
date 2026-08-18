import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton } from '../../src/components/layout/header-slots';
import { ProfileBody } from '../../src/components/member/profile-body';
import { Text } from '../../src/components/ui/text';
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

  const profile = getMemberProfile(id);

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
        <ProfileBody profile={profile} />
      </ScrollView>
    </View>
  );
}

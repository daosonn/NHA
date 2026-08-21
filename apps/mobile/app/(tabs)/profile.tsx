import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { ScreenTitle, SettingsButton } from '../../src/components/layout/header-slots';
import { ProfileBody } from '../../src/components/member/profile-body';
import { Text } from '../../src/components/ui/text';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useFamilies } from '../../src/features/family/use-families';
import { useFamilyTree } from '../../src/features/family/use-family-tree';
import { toMemberProfile } from '../../src/features/member/member-profile';
import { useToast } from '../../src/components/ui/toast';
import { useMyProfile, useUpdateAvatar } from '../../src/features/member/use-profile';
import { colors, spacing } from '../../src/theme';

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

  const toast = useToast();
  const { data: detail } = useMyProfile();
  const updateAvatar = useUpdateAvatar();
  const [permissionDenied, setPermissionDenied] = useState(false);

  /**
   * Square by request, not by crop: `allowsEditing` hands the platform's own
   * cropper to the person, so what they choose is what lands. Cropping it
   * afterwards on their behalf is how a face ends up half out of frame.
   */
  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setPermissionDenied(true);
      return;
    }

    setPermissionDenied(false);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    const asset = result.canceled ? undefined : result.assets[0];
    if (asset === undefined) return;

    updateAvatar.mutate(
      {
        id: asset.assetId ?? asset.uri,
        kind: 'photo',
        tone: 'light',
        uri: asset.uri,
        fileName: asset.fileName ?? 'avatar.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
      },
      {
        onSuccess: () => toast.success(t('profileEdit.avatar.saved')),
        onError: () => toast.failure(t('errors.generic')),
      },
    );
  };
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
        {permissionDenied && (
          <Text
            variant="caption"
            color={colors.themes.destructive.text}
            accessibilityRole="alert"
            style={{ paddingBottom: 10 }}
          >
            {t('moment.permissionDenied')}
          </Text>
        )}

        <ProfileBody
          profile={profile}
          familyId={familyId}
          memberId={memberId}
          ownProfile
          onEdit={() => router.push('/profile/edit')}
          onChangeAvatar={() => void pickAvatar()}
          uploadingAvatar={updateAvatar.isPending}
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

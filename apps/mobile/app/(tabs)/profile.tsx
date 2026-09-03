import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { ScreenTitle, SettingsButton } from '../../src/components/layout/header-slots';
import { ProfileBody } from '../../src/components/member/profile-body';
import { useTimelineScrollMotion } from '../../src/components/member/timeline-motion';
import { Text } from '../../src/components/ui/text';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useFamilies } from '../../src/features/family/use-families';
import { useFamilyTree } from '../../src/features/family/use-family-tree';
import { toMemberProfile } from '../../src/features/member/member-profile';
import { useToast } from '../../src/components/ui/toast';
import { useMyProfile, useUpdateAvatar } from '../../src/features/member/use-profile';
import { colors, spacing, useLayout } from '../../src/theme';

/**
 * Room the floating bottom bar needs at the end of the scroll.
 *
 * Only while the bar is at the bottom. From 1024px up the same destinations
 * are a rail down the left, which overlaps nothing, so reserving this much
 * there would just be 140px of dead space under the last row.
 */
const BOTTOM_INSET = 140;

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
  const { expanded } = useLayout();
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

  // Bắt ra hằng để narrowing sống sót vào closure bên dưới.
  const avatarMediaId = profile.avatarMediaId;

  // The timeline's scroll-linked motion lives with the screen because the
  // screen owns the ScrollView (`timeline-motion.ts`).
  const { motion, scrollHandler, frameRef, onFrameLayout, onContentSizeChange } =
    useTimelineScrollMotion();

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        center={<ScreenTitle title={t('nav.profile')} />}
        right={<SettingsButton onPress={() => router.push('/settings')} />}
        paddingRight={spacing.lg}
      />

      {/* The frame is what the effects measure against — the scroll viewport
          below the header, not the window. */}
      <View style={{ flex: 1 }} ref={frameRef} onLayout={onFrameLayout} collapsable={false}>
        <Animated.ScrollView
          onScroll={scrollHandler}
          onContentSizeChange={onContentSizeChange}
          scrollEventThrottle={16}
          contentContainerStyle={{
            ...contentColumn,
            paddingTop: spacing.xl,
            paddingBottom: expanded ? spacing['4xl'] : BOTTOM_INSET,
          }}
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
            timelineMotion={motion}
            onEdit={() => router.push('/profile/edit')}
            onEditTimeline={() => router.push('/profile/edit-timeline')}
            // The compose screen with every family unticked. Reusing it rather
            // than building a second uploader means a private picture gets the
            // same caption box, the same picker and the same tag rules as any
            // other — it just goes nowhere but here.
            onAddPrivate={() => router.push({ pathname: '/new', params: { private: '1' } })}
            onChangeAvatar={() => void pickAvatar()}
            uploadingAvatar={updateAvatar.isPending}
            // Không có ảnh thật thì vòng tròn chữ cái đứng yên — không có gì để xem
            onViewAvatar={
              avatarMediaId === null
                ? undefined
                : () => router.push({ pathname: '/media/[id]', params: { id: avatarMediaId } })
            }
            onAddMemo={() =>
              familyId === null || memberId === null
                ? undefined
                : router.push({ pathname: '/memo/edit', params: { familyId, memberId } })
            }
            onOpenMemo={(memo) => router.push({ pathname: '/memo/[id]', params: { id: memo.id } })}
            onEditMemo={(memo) => router.push({ pathname: '/memo/edit', params: { id: memo.id } })}
            onOpenMoment={(postId) =>
              router.push({ pathname: '/post/[id]', params: { id: postId } })
            }
            onOpenPhoto={(item) =>
              router.push({ pathname: '/media/[id]', params: { id: item.id, mime: item.mimeType } })
            }
          />
        </Animated.ScrollView>
      </View>
    </View>
  );
}

import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import {
  BackButton,
  NotificationBell,
  ScreenTitle,
} from '../../src/components/layout/header-slots';
import { ProfileBody } from '../../src/components/member/profile-body';
import { useTimelineScrollMotion } from '../../src/components/member/timeline-motion';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useFamilies } from '../../src/features/family/use-families';
import { useFamilyTree } from '../../src/features/family/use-family-tree';
import { toMemberProfile } from '../../src/features/member/member-profile';
import { useMemberProfile } from '../../src/features/member/use-profile';
import { spacing } from '../../src/theme';

/**
 * The Life Profile — the centre of the product.
 *
 * One profile per person, global across every family they belong to; the
 * relation word and the name a placeholder goes by are the two things scoped
 * to the family you arrived from, and both come out of the tree rather than
 * out of the profile.
 */
export default function MemberScreen() {
  // `tab` lets another screen open this one where it means to — Omoide
  // sends people to a person's photographs, not to their timeline.
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
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

  // Bắt ra hằng để narrowing sống sót vào closure bên dưới.
  const avatarMediaId = profile.avatarMediaId;

  // The timeline's scroll-linked motion lives with the screen because the
  // screen owns the ScrollView (`timeline-motion.ts`).
  const { motion, scrollHandler, frameRef, onFrameLayout, onContentSizeChange } =
    useTimelineScrollMotion();

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton />}
        center={<ScreenTitle title={profile.displayName} />}
        right={<NotificationBell />}
        paddingRight={spacing.lg}
      />

      {/* The frame is what the effects measure against — the scroll viewport
          below the header, not the window. */}
      <View style={{ flex: 1 }} ref={frameRef} onLayout={onFrameLayout} collapsable={false}>
        <Animated.ScrollView
          onScroll={scrollHandler}
          onContentSizeChange={onContentSizeChange}
          scrollEventThrottle={16}
          contentContainerStyle={{ ...contentColumn, paddingTop: spacing.xl, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <ProfileBody
            timelineMotion={motion}
            profile={profile}
            familyId={familyId}
            memberId={id}
            initialTab={tab === 'album' || tab === 'memo' ? tab : 'timeline'}
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
            onOpenMoment={(postId) =>
              router.push({ pathname: '/post/[id]', params: { id: postId } })
            }
            onViewAvatar={
              avatarMediaId === null
                ? undefined
                : () => router.push({ pathname: '/media/[id]', params: { id: avatarMediaId } })
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

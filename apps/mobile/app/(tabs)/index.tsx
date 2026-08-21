import { useRouter } from 'expo-router';
import { HousePlus, TriangleAlert } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { PostCard } from '../../src/components/feed/post-card';
import { EventWidget } from '../../src/components/home/event-widget';
import { GroupStrip, type FamilyGroupSummary } from '../../src/components/home/group-strip';
import { SwipeCue } from '../../src/components/home/moment-peek';
import { RecommendationGrid } from '../../src/components/home/recommendation-grid';
import { AppHeader } from '../../src/components/layout/app-header';
import { BrandWordmark, NotificationBell } from '../../src/components/layout/header-slots';
import { EmptyState } from '../../src/components/ui/empty-state';
import { SectionHeader } from '../../src/components/ui/section-header';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useFamilies } from '../../src/features/family/use-families';
import { takePendingInvite } from '../../src/features/family/pending-invite';
import { useMemberIdLookup } from '../../src/features/family/use-member-for-user';
import { useFamilyFeed } from '../../src/features/feed/use-family-feed';
import { useSetReaction } from '../../src/features/feed/use-post';
import { useSpecialDates } from '../../src/features/ai/use-special-dates';
import { defaultOccasion, notificationCount, recommendations } from '../../src/fixtures/home';
import type { FamilySummary, PostDetail } from '../../src/lib/api';
import { colors, spacing } from '../../src/theme';

/** Room for the bottom nav plus the home indicator. */
const BOTTOM_INSET = 140;

/**
 * Banner behind the occasion card. An app asset, not family media: the
 * occasion is a date on the calendar and owns no photo. Same reason the
 * recommendation tiles carry their own banners in `fixtures/home`.
 */
const OCCASION_BANNER = require('../../assets/banners/anniversary.jpg') as number;

/** How many faces the strip draws before it collapses the rest into "+N". */
const VISIBLE_GROUPS = 3;

/**
 * Một thẻ trên dòng thời gian, có trái tim bấm được.
 *
 * Là component riêng vì mỗi bài cần một `useSetReaction` của chính nó — hook
 * không gọi được trong `renderItem` của FlatList.
 */
function FeedCard({
  post,
  ...rest
}: { post: PostDetail } & Omit<React.ComponentProps<typeof PostCard>, 'post' | 'onToggleLike'>) {
  const setReaction = useSetReaction(post.id);
  return <PostCard post={post} onToggleLike={(type) => setReaction.mutate(type)} {...rest} />;
}

function toStripGroups(families: FamilySummary[]): FamilyGroupSummary[] {
  return families.slice(0, VISIBLE_GROUPS).map((family) => ({
    id: family.id,
    name: family.name,
    coverMediaId: family.coverMediaId,
  }));
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { familyId } = useActiveFamily();

  /**
   * Somebody who opened an invite link while signed out was sent through
   * sign-up, and the auth group lands everyone here afterwards. This is the
   * far end of that detour: take the code back out and finish the trip.
   *
   * Home rather than the sign-up screen because the same route serves people
   * who signed *in* instead, and because the auth redirect fires on the tick
   * the session appears — a return navigation from inside that screen races
   * it. See `features/family/pending-invite.ts`.
   */
  useEffect(() => {
    const code = takePendingInvite();
    if (code === null) return;

    router.replace({ pathname: '/invite/[code]', params: { code } });
  }, [router]);

  const { data: families, isPending, isError, refetch } = useFamilies();
  const feed = useFamilyFeed(familyId);
  const memberIdFor = useMemberIdLookup();
  const { data: occasions } = useSpecialDates(familyId);

  // Soonest first from the server, so the head of the list is the next one.
  const nextOccasion = occasions?.items[0];

  const posts: PostDetail[] = feed.data?.pages.flatMap((page) => page.items) ?? [];

  /** The pill on a card: which family this reached, in that family's own name. */
  const audienceLabel = (post: PostDetail): string | undefined => {
    if (post.familyIds.length === 0 || families === undefined) return undefined;
    if (post.familyIds.length > 1) return t('post.families', { count: post.familyIds.length });
    return families.find((family) => family.id === post.familyIds[0])?.name;
  };

  const openAuthor = (post: PostDetail) => {
    const memberId = memberIdFor(post.authorUserId);
    if (memberId === null) return undefined;
    return () => router.push({ pathname: '/member/[id]', params: { id: memberId } });
  };

  /**
   * Everything above the fold, per mockup 3a. It is the list header rather
   * than a separate screen because the mockup promises moments one swipe
   * further down — and on a phone, "swipe up for moments" is scrolling this
   * list. A gesture library would only reimplement what scrolling does.
   */
  const intro = (
    <View style={{ gap: 14, paddingBottom: 14 }}>
      {/* The + starts another group. Someone with no family at all lands on
          `/create-family` from the empty state below, which offers joining
          too — by the time this strip exists, they already have one. */}
      <GroupStrip
        groups={toStripGroups(families ?? [])}
        remainingCount={Math.max(0, (families?.length ?? 0) - VISIBLE_GROUPS)}
        onPress={() => router.push('/family')}
        onAddPress={() => router.push('/family/new')}
      />

      {/* Mốc thật của gia đình luôn thắng; khi chưa có mốc nào (chưa có gia
          đình, hoặc chưa ai khai ngày sinh) thì card vẫn vẽ với mốc mặc định
          của app — cùng lý do các thẻ おすすめ luôn có mặt. Trước đây khối này
          biến mất và màn Home khuyết một mảng lớn. */}
      <EventWidget
        occasion={nextOccasion ?? defaultOccasion()}
        moreCount={Math.max(0, (occasions?.items.length ?? 0) - 1)}
        image={OCCASION_BANNER}
      />

      {/* Recommendations are still a fixture: no endpoint exists for them. */}

      <SectionHeader title={t('home.recommendations')} actionLabel={t('home.seeAll')} />

      <RecommendationGrid feature={recommendations.feature} secondary={recommendations.secondary} />

      <SwipeCue />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.page }}>
      <AppHeader
        left={<BrandWordmark />}
        right={<NotificationBell count={notificationCount} />}
        paddingRight={spacing.lg}
      />

      {renderBody()}
    </View>
  );

  function renderBody() {
    if (isError) {
      return (
        <EmptyState
          renderIcon={({ size, color }) => (
            <TriangleAlert size={size} color={color} strokeWidth={2} />
          )}
          title={t('home.loadFailed')}
          actionLabel={t('home.retry')}
          onActionPress={() => void refetch()}
        />
      );
    }

    // Deliberately blank rather than a spinner: the request is usually faster
    // than a spinner is readable, and a flash of one is worse than a beat of
    // nothing.
    if (isPending || families === undefined) return null;

    // An account with no family is an ordinary state, not an error —
    // registration does not force anyone to make one first.
    if (families.length === 0) {
      return (
        <EmptyState
          renderIcon={({ size, color }) => <HousePlus size={size} color={color} strokeWidth={2} />}
          title={t('home.noFamilyTitle')}
          description={t('home.noFamilyBody')}
          actionLabel={t('home.startFamily')}
          onActionPress={() => router.push('/create-family')}
        />
      );
    }

    return (
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        ListHeaderComponent={intro}
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: BOTTOM_INSET,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
        // Only spend the cursor when the reader is nearly out of posts.
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        ListEmptyComponent={
          feed.isPending ? null : (
            <EmptyState
              renderIcon={({ size, color }) => (
                <HousePlus size={size} color={color} strokeWidth={2} />
              )}
              title={t('post.emptyTitle')}
              description={t('post.emptyBody')}
            />
          )
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <ActivityIndicator color={colors.coral.primary} style={{ paddingVertical: 16 }} />
          ) : null
        }
        renderItem={({ item }) => (
          <FeedCard
            post={item}
            audienceLabel={audienceLabel(item)}
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
            onAuthorPress={openAuthor(item)}
            onMediaPress={(m) =>
              router.push({ pathname: '/media/[id]', params: { id: m.id, mime: m.mimeType } })
            }
          />
        )}
      />
    );
  }
}

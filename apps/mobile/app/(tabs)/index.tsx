import { useRouter } from 'expo-router';
import { HousePlus, TriangleAlert } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { PostCard } from '../../src/components/feed/post-card';
import { EventWidget } from '../../src/components/home/event-widget';
import { GroupStrip, type FamilyGroupSummary } from '../../src/components/home/group-strip';
import { SwipeCue } from '../../src/components/home/moment-peek';
import { RecommendationGrid } from '../../src/components/home/recommendation-grid';
import { AppHeader } from '../../src/components/layout/app-header';
import { ContentColumn, contentColumn } from '../../src/components/layout/content-column';
import { BrandWordmark, NotificationBell } from '../../src/components/layout/header-slots';
import { EmptyState } from '../../src/components/ui/empty-state';
import { SectionHeader } from '../../src/components/ui/section-header';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useFamilies } from '../../src/features/family/use-families';
import { takePendingInvite } from '../../src/features/family/pending-invite';
import { useMemberLookup } from '../../src/features/family/use-member-for-user';
import { useMyFeed } from '../../src/features/feed/use-my-feed';
import { useSetReaction } from '../../src/features/feed/use-post';
import { useAlbums } from '../../src/features/album/use-albums';
import { useSpecialDates } from '../../src/features/ai/use-special-dates';
import { useRecommendations } from '../../src/features/home/use-recommendations';
import type { FamilySummary, PostDetail } from '../../src/lib/api';
import { colors, spacing, useLayout } from '../../src/theme';
import { enter } from '../../src/theme/motion';

/** How many feed cards join the intro's entrance cascade on first paint. */
const CASCADE_CARDS = 4;

/**
 * Room the floating bottom bar needs at the end of the scroll.
 *
 * Only while the bar is at the bottom. From 1024px up the same destinations
 * are a rail down the left, which overlaps nothing, so reserving this much
 * there would just be 160px of dead space under the last row.
 */
const BOTTOM_INSET = 160;

/** How many faces the strip draws before it collapses the rest into "+N". */
const VISIBLE_GROUPS = 3;

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
  const { expanded } = useLayout();
  const router = useRouter();
  const { familyId } = useActiveFamily();

  /**
   * Drives the pinned strip's condense. A shared value rather than state:
   * this updates on every scroll frame, and re-rendering the feed sixty
   * times a second to shrink a bar by seven pixels is not a trade worth
   * making.
   */
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

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
  // Feed là của CHUNG mọi nhà mình thuộc về (Sơn chốt 26/08) — nhà đang chọn
  // chỉ còn điều khiển cây, dịp sắp tới, tra tên tác giả; không lọc feed nữa.
  const feed = useMyFeed();
  const memberFor = useMemberLookup();
  const { data: occasions } = useSpecialDates(familyId);

  // Soonest first from the server, so the head of the list is the next one.
  const nextOccasion = occasions?.items[0];

  const posts: PostDetail[] = feed.data?.pages.flatMap((page) => page.items) ?? [];

  // The feed is already loaded above; the album list is one small request
  // and is what lets a shelf the viewer built turn up here too.
  const { data: albums } = useAlbums();
  const suggestions = useRecommendations(posts, albums);

  /** The pill on a card: which family this reached, in that family's own name. */
  const audienceLabel = (post: PostDetail): string | undefined => {
    if (post.familyIds.length === 0 || families === undefined) return undefined;
    if (post.familyIds.length > 1) return t('post.families', { count: post.familyIds.length });
    return families.find((family) => family.id === post.familyIds[0])?.name;
  };

  const openAuthor = (post: PostDetail) => {
    const member = memberFor(post.authorUserId);
    if (member === null) return undefined;
    return () => router.push({ pathname: '/member/[id]', params: { id: member.id } });
  };

  /**
   * Everything above the fold, per mockup 3a. It is the list header rather
   * than a separate screen because the mockup promises moments one swipe
   * further down — and on a phone, "swipe up for moments" is scrolling this
   * list. A gesture library would only reimplement what scrolling does.
   */
  const intro = (
    <View style={{ gap: 14, paddingBottom: 14 }}>
      {/* Drawn only when there is an occasion. Birthdays are derived from
          the birth dates on people's profiles, so a family who have not
          filled any in has nothing coming up — and an empty celebration
          card would be a strange thing to look at. */}
      {nextOccasion !== undefined && (
        <Animated.View entering={enter.up(0)}>
          <EventWidget occasion={nextOccasion} moreCount={(occasions?.items.length ?? 1) - 1} />
        </Animated.View>
      )}

      {/* Derived on the client from this family's own posts and albums —
          there is no endpoint for these. Seeded by the day, not
          `Math.random()`, so the shelf is stable while somebody looks at it
          and different tomorrow. */}

      {/* Hidden until the family has something old enough to resurface. An
          empty "look what turned up" is worse than no shelf, and a shelf of
          bundled stock photographs would be a claim about their life. */}
      {suggestions.length > 0 && (
        <Animated.View entering={enter.up(1)} style={{ gap: 14 }}>
          <SectionHeader title={t('home.recommendations')} />

          <RecommendationGrid
            tiles={suggestions}
            onSelect={(tile) =>
              tile.target.kind === 'album'
                ? router.push({ pathname: '/albums/[id]', params: { id: tile.target.id } })
                : router.push({ pathname: '/post/[id]', params: { id: tile.target.id } })
            }
          />
        </Animated.View>
      )}

      {/* Fades on the first flick — it has been followed by then. Entrance is
          fade-only: the cue's own opacity is scroll-driven, and a rising cue
          would point the wrong way. */}
      <Animated.View entering={enter.fade(2)}>
        <SwipeCue scrollY={scrollY} />
      </Animated.View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.page }}>
      {/* Kept at every width. The rail beside it rests as glyphs only, so this
          is the one place the app says its whole name — and without it the
          header row on a wide window is a bell and 1500px of nothing. */}
      <AppHeader left={<BrandWordmark />} right={<NotificationBell />} paddingRight={spacing.lg} />

      {/* Pinned, not scrolled with the feed. It is the only way into the
          family tree, and as the feed's first row it was gone after one
          flick. The + starts another group; somebody with no family at all
          lands on `/create-family` from the empty state below. */}
      {families !== undefined && families.length > 0 && (
        <ContentColumn style={{ paddingTop: 4, paddingBottom: 10 }}>
          <GroupStrip
            groups={toStripGroups(families)}
            remainingCount={Math.max(0, families.length - VISIBLE_GROUPS)}
            onPress={() => router.push('/family')}
            onAddPress={() => router.push('/family/new')}
            scrollY={scrollY}
          />
        </ContentColumn>
      )}

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
          cat
          renderIcon={({ size, color }) => <HousePlus size={size} color={color} strokeWidth={2} />}
          title={t('home.noFamilyTitle')}
          description={t('home.noFamilyBody')}
          actionLabel={t('home.startFamily')}
          onActionPress={() => router.push('/create-family')}
        />
      );
    }

    return (
      <Animated.FlatList
        data={posts}
        keyExtractor={(post: PostDetail) => post.id}
        ListHeaderComponent={intro}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          ...contentColumn,
          paddingBottom: expanded ? spacing['4xl'] : BOTTOM_INSET,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
        // Only spend the cursor when the reader is nearly out of posts.
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        ListEmptyComponent={
          feed.isPending ? null : feed.isError ? (
            // Feed tải HỎNG khác với feed TRỐNG: 404/500/mất mạng mà hiện
            // "chưa có bài" là nói sai với người đọc (Sơn dính 26/08 khi API
            // cũ chưa có /me/feed). Nói thật + cho thử lại.
            <EmptyState
              renderIcon={({ size, color }) => (
                <TriangleAlert size={size} color={color} strokeWidth={2} />
              )}
              title={t('home.loadFailed')}
              actionLabel={t('home.retry')}
              onActionPress={() => void feed.refetch()}
            />
          ) : (
            <EmptyState
              cat
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
        renderItem={({ item, index }: { item: PostDetail; index: number }) => (
          // The first screenful continues the intro's cascade (indices 3, 4,
          // …); cards mounted later by scrolling rise immediately — a card
          // that waits out a stagger delay mid-scroll reads as lag, not as
          // choreography.
          <Animated.View entering={enter.up(index < CASCADE_CARDS ? 3 + index : 0)}>
            <FeedCard
              post={item}
              audienceLabel={audienceLabel(item)}
              onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
              onAuthorPress={openAuthor(item)}
              onMediaPress={(m) =>
                router.push({ pathname: '/media/[id]', params: { id: m.id, mime: m.mimeType } })
              }
              authorAvatarId={memberFor(item.authorUserId)?.avatarKey}
            />
          </Animated.View>
        )}
      />
    );
  }
}

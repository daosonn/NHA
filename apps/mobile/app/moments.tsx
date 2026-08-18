import { useRouter } from 'expo-router';
import { Images, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { PostCard } from '../src/components/feed/post-card';
import { AppHeader } from '../src/components/layout/app-header';
import { BackButton } from '../src/components/layout/header-slots';
import { EmptyState } from '../src/components/ui/empty-state';
import { Text } from '../src/components/ui/text';
import { useActiveFamily } from '../src/features/family/active-family';
import { useFamilyFeed } from '../src/features/feed/use-family-feed';
import type { PostDetail } from '../src/lib/api';
import { colors, spacing } from '../src/theme';

/**
 * Everything shared to the family, newest first.
 *
 * Reached from the "swipe up for moments" cue on Home — the mockup promises a
 * list under the fold, and this is it.
 */
export default function MomentsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { familyId } = useActiveFamily();

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFamilyFeed(familyId);

  const items: PostDetail[] = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {t('post.momentsTitle')}
          </Text>
        }
      />

      {isError ? (
        <EmptyState
          renderIcon={({ size, color }) => (
            <TriangleAlert size={size} color={color} strokeWidth={2} />
          )}
          title={t('post.loadFailed')}
          actionLabel={t('home.retry')}
          onActionPress={() => void refetch()}
        />
      ) : isPending ? null : items.length === 0 ? (
        <EmptyState
          renderIcon={({ size, color }) => <Images size={size} color={color} strokeWidth={2} />}
          title={t('post.emptyTitle')}
          description={t('post.emptyBody')}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(post) => post.id}
          contentContainerStyle={{ padding: spacing.xl, gap: 14, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          // The cursor is only spent when the reader is nearly out of posts;
          // paging on first render would fetch a page nobody has reached.
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={colors.coral.primary} style={{ paddingVertical: 16 }} />
            ) : null
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
    </View>
  );
}

import { Image } from 'expo-image';
import { Camera, Images, Milestone, Play, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import type { GalleryGroup, MemberGallery } from '../../features/member/use-member-gallery';
import { mediaSource } from '../../lib/media-source';
import { colors, radius } from '../../theme';
import { EmptyState } from '../ui/empty-state';
import { Text } from '../ui/text';

const GRID_GAP = 10;

/**
 * Tiles alternate between these two shapes.
 *
 * The mockup staggers the two columns, which needs either measured heights or
 * a rule. A rule is enough here and costs nothing: a masonry that reflows as
 * pictures decode would move things under the reader's thumb, and the point
 * of the stagger is rhythm, not accuracy.
 */
const SHAPES = [1.15, 0.86];

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        height: 20,
        paddingHorizontal: 7,
        borderRadius: radius.full,
        backgroundColor: 'rgba(24,24,27,0.62)',
      }}
    >
      {children}
    </View>
  );
}

function MomentTile({
  group,
  aspectRatio,
  onPress,
}: {
  group: GalleryGroup;
  aspectRatio: number;
  onPress?: () => void;
}) {
  const { t } = useTranslation();

  const cover = group.media[0];
  if (cover === undefined) return null;

  const isVideo = cover.mimeType.startsWith('video/');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={t(
        group.kind === 'event' ? 'member.moments.openMilestone' : 'member.moments.openMoment',
        { count: group.media.length },
      )}
      style={{
        aspectRatio,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: colors.background.subtle,
      }}
    >
      <Image
        source={mediaSource(cover.id)}
        recyclingKey={cover.id}
        contentFit="cover"
        transition={160}
        style={{ width: '100%', height: '100%' }}
      />

      <View
        style={{
          position: 'absolute',
          left: 8,
          right: 8,
          bottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
        pointerEvents="none"
      >
        {/* A milestone's photographs are the only ones on this page that did
            not come from the feed, and tapping one goes somewhere different.
            Saying which is which beats letting the destination surprise. */}
        {group.kind === 'event' ? (
          <Badge>
            <Milestone size={10} color={colors.text.white} strokeWidth={2.4} />
            <Text variant="badge" weight="semibold" color={colors.text.white}>
              {t('member.moments.milestone')}
            </Text>
          </Badge>
        ) : (
          <View />
        )}

        {isVideo ? (
          <Badge>
            {/* The mockup shows a running time. `GalleryMediaItem` carries id,
                mime type and size and no duration, so this says "video" and
                stops there rather than making a number up. */}
            <Play size={10} color={colors.text.white} strokeWidth={2.4} fill={colors.text.white} />
            <Text variant="badge" weight="semibold" color={colors.text.white}>
              {t('member.moments.video')}
            </Text>
          </Badge>
        ) : group.media.length > 1 ? (
          <Badge>
            <Images size={10} color={colors.text.white} strokeWidth={2.4} />
            <Text variant="badge" weight="semibold" color={colors.text.white}>
              {group.media.length}
            </Text>
          </Badge>
        ) : null}
      </View>
    </Pressable>
  );
}

export type AlbumGridProps = {
  gallery: MemberGallery | undefined;
  memberName: string;
  /** Your own page, which is addressed in the second person. */
  own?: boolean;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  /** A moment that came from a post. */
  onOpenMoment?: (postId: string) => void;
  /** A milestone's photographs, which live on the Timeline tab. */
  onOpenTimeline?: () => void;
};

/**
 * "Moments together" — mockup 7.
 *
 * Grouped by moment rather than spread out as loose photographs, because a
 * moment is what a family remembers: one tile is one thing that happened, and
 * the count on it says how much of it there is to look at.
 *
 * **Derived, not curated.** The server assembles this from the posts the
 * person authored or was tagged in plus their life-event media. Nobody
 * curates it, and there is no way to put a picture on somebody's page
 * directly — which is why there is no "add photo" action here. A moment is
 * posted, and the people in it are tagged in the composer.
 *
 * One deliberate departure from the mockup: it writes an event's title across
 * its cover ("TẾT 2019"). `GalleryMediaItem` carries no title, and fetching
 * one post per tile to find it would trade a legible grid for a burst of
 * requests. The tiles say how many and what kind instead.
 */
export function AlbumGrid({
  gallery,
  memberName,
  own = false,
  loading = false,
  failed = false,
  onRetry,
  onOpenMoment,
  onOpenTimeline,
}: AlbumGridProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: 'center' }}>
        <ActivityIndicator color={colors.coral.primary} />
      </View>
    );
  }

  if (failed) {
    return (
      <EmptyState
        renderIcon={(props) => <TriangleAlert {...props} strokeWidth={2} />}
        title={t('member.moments.failed')}
        actionLabel={t('home.retry')}
        onActionPress={onRetry}
      />
    );
  }

  const groups = gallery?.groups ?? [];

  if (groups.length === 0) {
    return (
      <EmptyState
        renderIcon={(props) => <Camera {...props} strokeWidth={2} />}
        title={t('member.moments.empty')}
        description={
          own
            ? t('member.moments.emptyBodyOwn')
            : t('member.moments.emptyBody', { name: memberName })
        }
      />
    );
  }

  const columns: GalleryGroup[][] = [[], []];
  groups.forEach((group, index) => columns[index % 2]?.push(group));

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 3 }}>
        <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
          {own ? t('member.moments.headingOwn') : t('member.moments.heading')}
        </Text>

        <Text variant="caption" color={colors.text.muted}>
          {t('member.moments.counts', {
            photos: gallery?.photoCount ?? 0,
            count: groups.length,
          })}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: GRID_GAP }}>
        {columns.map((column, columnIndex) => (
          <View key={columnIndex} style={{ flex: 1, gap: GRID_GAP }}>
            {column.map((group, rowIndex) => (
              <MomentTile
                key={group.key}
                group={group}
                // Offset by column so the two sides never step together.
                aspectRatio={SHAPES[(rowIndex + columnIndex) % SHAPES.length] ?? 1}
                onPress={
                  group.postId !== null
                    ? () => onOpenMoment?.(group.postId as string)
                    : group.kind === 'event'
                      ? onOpenTimeline
                      : undefined
                }
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

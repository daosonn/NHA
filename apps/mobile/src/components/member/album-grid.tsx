import { Image } from 'expo-image';
import { Camera, Images, Play, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import type { MemberMoments } from '../../features/member/use-member-moments';
import type { PostDetail } from '../../lib/api';
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
  moment,
  aspectRatio,
  onPress,
}: {
  moment: PostDetail;
  aspectRatio: number;
  onPress?: () => void;
}) {
  const { t } = useTranslation();

  const cover = moment.media[0];
  if (cover === undefined) return null;

  const isVideo = cover.mimeType.startsWith('video/');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={t('member.moments.openMoment', {
        title: moment.eventTitle ?? moment.authorName,
        count: moment.media.length,
      })}
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

      {/* An event names itself over its own cover, the way the mockup writes
          "TẾT 2019" across the picture. A plain post has no title to write. */}
      {moment.eventTitle !== null && (
        <View
          style={{
            position: 'absolute',
            left: 10,
            right: 10,
            top: '50%',
            alignItems: 'center',
          }}
          pointerEvents="none"
        >
          <Text
            variant="caption"
            weight="bold"
            color={colors.text.white}
            numberOfLines={1}
            style={{ letterSpacing: 0.6, textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6 }}
          >
            {moment.eventTitle}
          </Text>
        </View>
      )}

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
        {/* Who put it there. A stripe placeholder for now — members have no
            avatar image, only `avatarKey`, and nothing uploads one yet. */}
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: radius.full,
            backgroundColor: 'rgba(255,255,255,0.9)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="badge" weight="bold" color={colors.text.secondary}>
            {moment.authorName.slice(0, 1).toUpperCase()}
          </Text>
        </View>

        {isVideo ? (
          <Badge>
            {/* The mockup shows a running time. `PostMediaSummary` carries id,
                mime type and size and no duration, so this says "video" and
                stops there rather than making a number up. */}
            <Play size={10} color={colors.text.white} strokeWidth={2.4} fill={colors.text.white} />
            <Text variant="badge" weight="semibold" color={colors.text.white}>
              {t('member.moments.video')}
            </Text>
          </Badge>
        ) : moment.media.length > 1 ? (
          <Badge>
            <Images size={10} color={colors.text.white} strokeWidth={2.4} />
            <Text variant="badge" weight="semibold" color={colors.text.white}>
              {moment.media.length}
            </Text>
          </Badge>
        ) : null}
      </View>
    </Pressable>
  );
}

export type AlbumGridProps = {
  moments: MemberMoments | undefined;
  memberName: string;
  /** Your own page, which is addressed in the second person. */
  own?: boolean;
  /** No family on screen, so there is no feed this could be read from. */
  noFamily?: boolean;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  onOpenMoment?: (moment: PostDetail) => void;
};

/**
 * "Moments together" — mockup 7.
 *
 * Grouped by moment rather than spread out as loose photographs, because a
 * moment is what a family remembers: one tile is one thing that happened, and
 * the count on it says how much of it there is to look at.
 *
 * **Derived, not curated.** These are the family's posts that this person is
 * tagged in or posted themselves. Nobody assembles them, and there is no way
 * to add a picture to somebody's page directly — which is why there is no
 * "add photo" action here. A moment is posted, and the people in it are
 * tagged in the composer.
 */
export function AlbumGrid({
  moments,
  memberName,
  own = false,
  noFamily = false,
  loading = false,
  failed = false,
  onRetry,
  onOpenMoment,
}: AlbumGridProps) {
  const { t } = useTranslation();

  if (noFamily) {
    return (
      <EmptyState
        renderIcon={(props) => <Camera {...props} strokeWidth={2} />}
        title={t('member.moments.empty')}
        description={t('member.moments.noFamily')}
      />
    );
  }

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

  const items = moments?.items ?? [];

  if (items.length === 0) {
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

  const columns: PostDetail[][] = [[], []];
  items.forEach((moment, index) => columns[index % 2]?.push(moment));

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 3 }}>
        <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
          {own ? t('member.moments.headingOwn') : t('member.moments.heading')}
        </Text>

        <Text variant="caption" color={colors.text.muted}>
          {t('member.moments.counts', {
            photos: moments?.photoCount ?? 0,
            count: items.length,
          })}
        </Text>

        {/* Said out loud, because a partial album that looks complete is a
            lie about somebody's life. See `use-member-moments.ts`. */}
        {moments?.complete === false && (
          <Text variant="badge" color={colors.text.subtle}>
            {t('member.moments.partial')}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: GRID_GAP }}>
        {columns.map((column, columnIndex) => (
          <View key={columnIndex} style={{ flex: 1, gap: GRID_GAP }}>
            {column.map((moment, rowIndex) => (
              <MomentTile
                key={moment.id}
                moment={moment}
                // Offset by column so the two sides never step together.
                aspectRatio={SHAPES[(rowIndex + columnIndex) % SHAPES.length] ?? 1}
                onPress={() => onOpenMoment?.(moment)}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

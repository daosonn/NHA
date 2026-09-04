import { MapPin, Milestone, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colors, elevation, radius } from '../../theme';
import type { LifeEventDetail } from '../../lib/api';
import { dayOnly, formatDayMonth } from '../../lib/date';
import { thumbnailSource } from '../../lib/media-source';
import { EmptyState } from '../ui/empty-state';
import { Text } from '../ui/text';
import { EventPhotos } from './event-photos';
import {
  TL,
  useTimelineListMotion,
  useTimelineRowMotion,
  type TimelineMotion,
} from './timeline-motion';

type RowProps = {
  event: LifeEventDetail;
  /** Opens one of this entry's photos full size. */
  onOpenPhoto?: (media: { id: string; mimeType: string }) => void;
  isLatest: boolean;
  /** This row's index in the list — how it finds its own scroll metrics. */
  index: number;
  /** Scroll-linked motion. Absent = the static timeline, unchanged. */
  motion?: TimelineMotion;
};

/**
 * One white card beside the rail (the handoff's `.card`): year chip, title,
 * description, photos. The dot and the triangle pointing at it sit OUTSIDE
 * the card, so the card can scale toward the reading point without
 * dragging them off the rail.
 */
function TimelineRow({ event, isLatest, index, motion, onOpenPhoto }: RowProps) {
  // The editor stores a year-only entry as Jan 1 (`parseWhen` in
  // edit-timeline.tsx) — the schema has no "no day given" state. So a
  // 01-01 date is read back as year-only and the card shows just the year
  // chip, no invented "1 Jan". An entry genuinely dated New Year's Day
  // pays for this by losing its day label.
  const yearOnly = dayOnly(event.eventDate).endsWith('-01-01');
  const day = yearOnly ? null : formatDayMonth(event.eventDate);
  const meta = [event.place, day].filter((part) => part !== null).join(' · ');

  const {
    rowRef,
    rowStyle,
    contentStyle,
    dotStyle,
    haloStyle,
    activeAccentStyle,
    parallaxStyle,
    onRowLayout,
  } = useTimelineRowMotion(motion, index);

  return (
    // The plain outer wrapper is what the motion measures (box + re-measure
    // sweep) — it must stay untransformed, so the entrance translate lives
    // on the inner view. collapsable, or Android flattens it away from the
    // measuring refs.
    <View ref={rowRef} onLayout={onRowLayout} collapsable={false}>
      <Animated.View style={rowStyle}>
        <Animated.View
          style={[
            {
              marginLeft: TL.cardInset,
              backgroundColor: colors.background.card,
              borderRadius: radius['3xl'],
              borderWidth: 1,
              borderColor: colors.state.borderDefault,
              padding: 14,
              gap: 10,
              // The card clips its own children: the coral bar is a plain
              // rectangle and the rounded corners cut it, the way the
              // handoff's inset box-shadow followed the card's radius. A 4px
              // bar carrying its own radius-20 corners pokes out of the
              // card's curve instead.
              overflow: 'hidden',
              transformOrigin: `0px ${TL.dotCentreY}px`,
              ...elevation.card,
            },
            contentStyle,
          ]}
        >
          {/* The coral accent down the active card's left edge — the
            handoff's `inset 4px 0 0` box-shadow. A left border on a
            full-card overlay sharing the card's radius reproduces it
            exactly: the band hugs the edge and its ends taper around the
            corner arcs, the way an inset shadow follows a rounded box. */}
          {motion !== undefined && (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderLeftWidth: 4,
                  borderLeftColor: colors.coral.primary,
                  borderRadius: radius['3xl'],
                },
                activeAccentStyle,
              ]}
            />
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                height: 24,
                paddingHorizontal: 10,
                borderRadius: radius.full,
                backgroundColor: colors.coral.soft,
                justifyContent: 'center',
              }}
            >
              <Text
                serif
                weight="semibold"
                color={colors.coral.deep}
                style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.8 }}
              >
                {event.eventDate.slice(0, 4)}
              </Text>
            </View>
          </View>

          <Text variant="body1" weight="semibold">
            {event.title}
          </Text>

          {meta !== '' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {event.place !== null && (
                <MapPin size={12} color={colors.text.subtle} strokeWidth={2} />
              )}
              <Text variant="caption" color={colors.text.subtle}>
                {meta}
              </Text>
            </View>
          )}

          {event.description !== null && (
            <Text variant="body2" color={colors.text.body}>
              {event.description}
            </Text>
          )}

          {event.media.length > 0 && (
            <EventPhotos
              photos={event.media.map((item) => ({
                key: item.id,
                mediaId: item.id,
                mimeType: item.mimeType,
                source: thumbnailSource(item.id, item.mimeType),
              }))}
              parallaxStyle={motion === undefined ? undefined : parallaxStyle}
              onOpen={
                onOpenPhoto === undefined
                  ? undefined
                  : (photo) => {
                      if (photo.mediaId === undefined || photo.mimeType === undefined) return;
                      onOpenPhoto({ id: photo.mediaId, mimeType: photo.mimeType });
                    }
              }
            />
          )}
        </Animated.View>

        {/* Dot + halo, pinned to the rail. Coral follows the READING position
          with motion on; statically it marks the latest entry instead. */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: TL.dotLeft,
              top: TL.dotTop,
              width: TL.dot,
              height: TL.dot,
              borderRadius: radius.full,
              backgroundColor: colors.background.card,
              borderWidth: 3,
              borderColor:
                motion === undefined && isLatest ? colors.coral.brand : colors.state.borderDashed,
            },
            dotStyle,
          ]}
        >
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: -5,
                left: -5,
                right: -5,
                bottom: -5,
                borderRadius: radius.full,
                borderWidth: 1.5,
                borderColor: colors.coral.brand,
                opacity: 0,
              },
              haloStyle,
            ]}
          />
        </Animated.View>

        {/* The triangle pointing from the card at the active dot. */}
        {motion !== undefined && (
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', left: TL.triLeft, top: TL.triTop }, activeAccentStyle]}
          >
            <Svg width={13} height={16} viewBox="0 0 13 16">
              <Path d="M13 0.5 L1 8 L13 15.5 Z" fill={colors.coral.primary} />
            </Svg>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

export type TimelineListProps = {
  events: LifeEventDetail[];
  /**
   * A photograph on the timeline was the only one in the app that did
   * nothing when tapped — the Album tab has opened them full size all along.
   */
  onOpenPhoto?: (media: { id: string; mimeType: string }) => void;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  /** Adds a milestone — wired to the staged editor on your own profile. */
  onAddEvent?: () => void;
  /**
   * Scroll-linked motion from the route that owns the ScrollView
   * (`timeline-motion.ts`). Absent — reduced motion, or a context without
   * a scroll owner — the timeline renders static.
   */
  motion?: TimelineMotion;
};

/**
 * A life in the order it was lived — oldest first, as cards down a rail
 * (the owner's handoff `src/edit-timeline.html`).
 *
 * A feed reads newest-first because the top is the news; a life story reads
 * the other way, because the top is the beginning. With scroll motion on,
 * the coral dot follows the reader down the rail and the rail fills behind
 * them; without it, coral marks the most recent entry, which is where the
 * reader ends up.
 */
export function TimelineList({
  events,
  loading = false,
  failed = false,
  onRetry,
  onAddEvent,
  onOpenPhoto,
  motion,
}: TimelineListProps) {
  const { t } = useTranslation();

  const { listRef, onListLayout, progressStyle } = useTimelineListMotion(motion, events.length);

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
        title={t('member.timelineFailed')}
        actionLabel={t('home.retry')}
        onActionPress={onRetry}
      />
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        renderIcon={(props) => <Milestone {...props} strokeWidth={2} />}
        title={t('member.timelineEmpty')}
        description={t('member.timelineEmptyBody')}
        actionLabel={t('member.timelineEmptyAction')}
        onActionPress={onAddEvent}
      />
    );
  }

  return (
    // collapsable=false: the root is measured against the scroll frame, and
    // Android would otherwise flatten a plain View out of the tree.
    <View ref={listRef} onLayout={onListLayout} collapsable={false} style={{ gap: 16 }}>
      {/* One continuous rail behind every card: the gray line, then the
          coral fill scaling down to the active dot. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: TL.railX,
          top: TL.railTop,
          bottom: 0,
          width: TL.railW,
          borderRadius: radius.full,
          backgroundColor: colors.state.borderStrong,
        }}
      />
      {motion !== undefined && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: TL.railX,
              top: TL.railTop,
              bottom: 0,
              width: TL.railW,
              borderRadius: radius.full,
              backgroundColor: colors.coral.primary,
              transformOrigin: 'top',
            },
            progressStyle,
          ]}
        />
      )}

      {events.map((event, i) => (
        <TimelineRow
          key={event.id}
          event={event}
          isLatest={i === events.length - 1}
          index={i}
          motion={motion}
          onOpenPhoto={onOpenPhoto}
        />
      ))}
    </View>
  );
}

import { MapPin, Milestone, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors, radius } from '../../theme';
import type { LifeEventDetail } from '../../lib/api';
import { formatDayMonth } from '../../lib/date';
import { thumbnailSource } from '../../lib/media-source';
import { EmptyState } from '../ui/empty-state';
import { Text } from '../ui/text';
import { EventPhotos } from './event-photos';
import {
  useTimelineListMotion,
  useTimelineRowMotion,
  type TimelineMotion,
} from './timeline-motion';

const YEAR_COLUMN = 40;
const RAIL_COLUMN = 16;
const DOT = 11;
/** Distance from the row top to the dot's centre — where the rail line starts. */
const DOT_CENTRE = DOT / 2 + 3;

type RowProps = {
  event: LifeEventDetail;
  /** Opens one of this entry's photos full size. */
  onOpenPhoto?: (media: { id: string; mimeType: string }) => void;
  /** Repeated years are drawn once — the rail already implies continuity. */
  showYear: boolean;
  isLatest: boolean;
  isLast: boolean;
  /** This row's index in the list — how it finds its own scroll metrics. */
  index: number;
  /** Scroll-linked motion. Absent = the static timeline, unchanged. */
  motion?: TimelineMotion;
};

function TimelineRow({ event, showYear, isLatest, isLast, index, motion, onOpenPhoto }: RowProps) {
  const day = formatDayMonth(event.eventDate);
  const meta = [event.place, day].filter((part) => part !== null).join(' · ');

  const { rowStyle, contentStyle, dotStyle, haloStyle, fillStyle, parallaxStyle, onRowLayout } =
    useTimelineRowMotion(motion, index);

  return (
    <Animated.View style={[{ flexDirection: 'row', gap: 10 }, rowStyle]} onLayout={onRowLayout}>
      <View style={{ width: YEAR_COLUMN, alignItems: 'flex-end' }}>
        {showYear && (
          <Text serif variant="body2" weight="semibold" color={colors.text.muted}>
            {event.eventDate.slice(0, 4)}
          </Text>
        )}
      </View>

      <View style={{ width: RAIL_COLUMN, alignItems: 'center' }}>
        {!isLast && (
          <View
            style={{
              position: 'absolute',
              top: DOT_CENTRE,
              bottom: 0,
              width: 1.5,
              backgroundColor: colors.state.borderStrong,
            }}
          />
        )}

        {/* The coral fill sliding down the rail as the active card moves.
            It scales from the top rather than growing in height, so the
            per-frame work stays on transform/opacity. */}
        {!isLast && motion !== undefined && (
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: DOT_CENTRE,
                bottom: 0,
                width: 1.5,
                backgroundColor: colors.coral.primary,
                transformOrigin: 'top',
              },
              fillStyle,
            ]}
          />
        )}

        {motion === undefined ? (
          <View
            style={{
              width: DOT,
              height: DOT,
              marginTop: 3,
              borderRadius: radius.full,
              backgroundColor: isLatest ? colors.coral.primary : colors.background.card,
              borderWidth: isLatest ? 0 : 1.5,
              borderColor: colors.state.borderDashed,
            }}
          />
        ) : (
          // With motion on, coral follows the READING position instead of
          // marking the latest entry — the active dot swells with a coral
          // ring and a pulsing halo.
          <Animated.View
            style={[
              {
                width: DOT,
                height: DOT,
                marginTop: 3,
                borderRadius: radius.full,
                backgroundColor: colors.background.card,
                borderWidth: 1.5,
                borderColor: colors.state.borderDashed,
              },
              dotStyle,
            ]}
          >
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: -2,
                  left: -2,
                  right: -2,
                  bottom: -2,
                  borderRadius: radius.full,
                  borderWidth: 1.5,
                  borderColor: colors.coral.brand,
                },
                haloStyle,
              ]}
            />
          </Animated.View>
        )}
      </View>

      <Animated.View
        style={[
          {
            flex: 1,
            gap: 3,
            paddingBottom: isLast ? 0 : 22,
            // Scaling anchors to the rail side, so the text never drifts
            // away from its dot while it grows toward the reading point.
            transformOrigin: 'left center',
          },
          contentStyle,
        ]}
      >
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

        {/* The photos themselves — a count line stood here until the editor
            made attaching them easy, and a number is not a photograph. */}
        {event.media.length > 0 && (
          <View style={{ marginTop: 4 }}>
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
          </View>
        )}
      </Animated.View>
    </Animated.View>
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
  /**
   * Adds a milestone. Nothing passes it yet — `LifeEvent` has no endpoint
   * (task 1.6.8), so the button is simply not drawn.
   *
   * When it does arrive it is gated the same way the profile is, because a
   * life event is part of that profile: your own timeline and a placeholder's
   * are editable, a linked member's is theirs alone
   * (`docs/00-shared/domain-model.md` → wiki-style). `ProfileBody` already
   * holds the `editability` that decides it.
   */
  onAddEvent?: () => void;
  /**
   * Scroll-linked motion from the route that owns the ScrollView
   * (`timeline-motion.ts`). Absent — reduced motion, or a context without
   * a scroll owner — the timeline renders static, exactly as before.
   */
  motion?: TimelineMotion;
};

/**
 * A life in the order it was lived — oldest first.
 *
 * A feed reads newest-first because the top is the news; a life story reads
 * the other way, because the top is the beginning. With scroll motion on,
 * the coral node follows the reader down the rail; without it, the most
 * recent event is the one coral node, which is where the reader ends up.
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

  const { listRef, onListLayout } = useTimelineListMotion(motion, events.length);

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
    // Android would otherwise flatten a style-less View out of the tree.
    <View ref={listRef} onLayout={onListLayout} collapsable={false}>
      {events.map((event, i) => (
        <TimelineRow
          key={event.id}
          event={event}
          showYear={i === 0 || event.eventDate.slice(0, 4) !== events[i - 1]?.eventDate.slice(0, 4)}
          isLatest={i === events.length - 1}
          isLast={i === events.length - 1}
          index={i}
          motion={motion}
          onOpenPhoto={onOpenPhoto}
        />
      ))}
    </View>
  );
}

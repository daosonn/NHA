import { MapPin, Milestone, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { colors, radius } from '../../theme';
import type { LifeEventDetail } from '../../lib/api';
import { formatDayMonth } from '../../lib/date';
import { thumbnailSource } from '../../lib/media-source';
import { EmptyState } from '../ui/empty-state';
import { Text } from '../ui/text';
import { EventPhotos } from './event-photos';

const YEAR_COLUMN = 40;
const RAIL_COLUMN = 16;
const DOT = 11;
/** Distance from the row top to the dot's centre — where the rail line starts. */
const DOT_CENTRE = DOT / 2 + 3;

type RowProps = {
  event: LifeEventDetail;
  /** Repeated years are drawn once — the rail already implies continuity. */
  showYear: boolean;
  isLatest: boolean;
  isLast: boolean;
};

function TimelineRow({ event, showYear, isLatest, isLast }: RowProps) {
  const day = formatDayMonth(event.eventDate);
  const meta = [event.place, day].filter((part) => part !== null).join(' · ');

  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
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
      </View>

      <View style={{ flex: 1, gap: 3, paddingBottom: isLast ? 0 : 22 }}>
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
                source: thumbnailSource(item.id, item.mimeType),
              }))}
            />
          </View>
        )}
      </View>
    </View>
  );
}

export type TimelineListProps = {
  events: LifeEventDetail[];
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
};

/**
 * A life in the order it was lived — oldest first.
 *
 * A feed reads newest-first because the top is the news; a life story reads
 * the other way, because the top is the beginning. The most recent event is
 * the one coral node, which is where the reader ends up.
 */
export function TimelineList({
  events,
  loading = false,
  failed = false,
  onRetry,
  onAddEvent,
}: TimelineListProps) {
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
    <View>
      {events.map((event, i) => (
        <TimelineRow
          key={event.id}
          event={event}
          showYear={i === 0 || event.eventDate.slice(0, 4) !== events[i - 1]?.eventDate.slice(0, 4)}
          isLatest={i === events.length - 1}
          isLast={i === events.length - 1}
        />
      ))}
    </View>
  );
}

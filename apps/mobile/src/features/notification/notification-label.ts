import type { NotificationDetail, NotificationPayload } from '../../lib/api';

/**
 * `payload` is JSON on the wire and `unknown` in the mirror, so it is read
 * field by field rather than cast. A notification whose payload is not what
 * this expects still draws — as a line with no destination — instead of
 * taking the screen down with it.
 */
export function payloadOf(item: NotificationDetail): NotificationPayload {
  if (typeof item.payload !== 'object' || item.payload === null) return {};

  const raw = item.payload as Record<string, unknown>;
  const str = (key: string) => (typeof raw[key] === 'string' ? (raw[key] as string) : undefined);
  const num = (key: string) => (typeof raw[key] === 'number' ? (raw[key] as number) : undefined);

  return {
    postId: str('postId'),
    actorUserId: str('actorUserId'),
    kind: str('kind'),
    familyId: str('familyId'),
    memberId: str('memberId'),
    specialDateId: str('specialDateId'),
    displayName: str('displayName'),
    title: str('title'),
    occursOn: str('occursOn'),
    daysUntil: num('daysUntil'),
  };
}

export type NotificationLine = {
  /** Catalogue key. */
  key: string;
  values: Record<string, string | number>;
};

/**
 * What a notification says.
 *
 * **No names on the post ones.** `NEW_POST`, `COMMENT`, `REACTION` and
 * `MEMBER_TAG` carry `actorUserId` and nothing else, and an id is not a name
 * — resolving it would mean holding every family's tree in memory on the
 * chance that somebody from one of them commented. The reminders show how it
 * should look: they snapshot `displayName` into the payload at the moment the
 * row is written, exactly so the client never has to look anybody up. Adding
 * `actorName` alongside `actorUserId` would let these read "Mai commented on
 * your moment" — worth asking for.
 */
export function notificationLine(item: NotificationDetail): NotificationLine {
  const payload = payloadOf(item);
  const days = payload.daysUntil;

  switch (item.type) {
    case 'NEW_POST':
      return { key: 'notifications.types.newPost', values: {} };
    case 'COMMENT':
      return { key: 'notifications.types.comment', values: {} };
    case 'REACTION':
      return { key: 'notifications.types.reaction', values: {} };
    case 'MEMBER_TAG':
      return { key: 'notifications.types.memberTag', values: {} };
    case 'FAMILY_INVITE':
      return { key: 'notifications.types.familyInvite', values: {} };

    case 'BIRTHDAY_REMINDER': {
      const name = payload.displayName ?? '';
      if (days === undefined) return { key: 'notifications.types.birthday', values: { name } };
      return days <= 0
        ? { key: 'notifications.types.birthdayToday', values: { name } }
        : { key: 'notifications.types.birthdayIn', values: { name, count: days } };
    }

    case 'EVENT_REMINDER': {
      // Two producers: a stored occasion brings a `title`, a derived one
      // about a person brings their name instead.
      const what = payload.title ?? payload.displayName ?? '';
      if (days === undefined) return { key: 'notifications.types.event', values: { what } };
      return days <= 0
        ? { key: 'notifications.types.eventToday', values: { what } }
        : { key: 'notifications.types.eventIn', values: { what, count: days } };
    }

    case 'CARE_REMINDER':
      return {
        key: 'notifications.types.care',
        values: { name: payload.displayName ?? '' },
      };

    default:
      return { key: 'notifications.types.aiSuggestion', values: {} };
  }
}

export type NotificationTarget =
  { kind: 'post'; id: string } | { kind: 'member'; id: string } | null;

/**
 * Where tapping it goes, or nothing.
 *
 * Nothing is a real answer: an AI suggestion has no screen of its own yet,
 * and a row that does nothing when pressed is better than one that opens
 * something unrelated.
 */
export function notificationTarget(item: NotificationDetail): NotificationTarget {
  const payload = payloadOf(item);

  if (payload.postId !== undefined) return { kind: 'post', id: payload.postId };
  if (payload.memberId !== undefined) return { kind: 'member', id: payload.memberId };
  return null;
}

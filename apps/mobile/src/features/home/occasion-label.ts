import type { SpecialDateItem } from '../../lib/api';

/**
 * Wording an occasion is the client's job, and deliberately so.
 *
 * The server sends a type, an ordinal and a list of names, and no sentence at
 * all — `special-date.service.ts` says why: "turns 63" and 「63歳になります」
 * are not the same sentence with the words exchanged, so a string assembled
 * on the server could never be translated afterwards. Everything here is a
 * catalogue key plus its values.
 */
export type OccasionLabel = { key: string; values: Record<string, string | number> };

/** "Mai & Hoàng", in the order the server listed them. */
function names(item: SpecialDateItem): string {
  return item.members.map((member) => member.displayName).join(' & ');
}

/**
 * How far off it is, as a key and a count.
 *
 * Today and tomorrow get their own keys rather than "in 0 days" and "in 1
 * day" — nobody says either of those, in any of the languages here.
 */
export function countdownLabel(daysUntil: number): OccasionLabel {
  if (daysUntil <= 0) return { key: 'home.occasion.today', values: {} };
  if (daysUntil === 1) return { key: 'home.occasion.tomorrow', values: {} };
  return { key: 'home.occasion.inDays', values: { count: daysUntil } };
}

/**
 * What the occasion is called.
 *
 * A custom occasion brought its own title and keeps it. A derived one is
 * worded from the type, and the ordinal decides which of two sentences: with
 * a birth year known, a birthday can say the age; without one it can only say
 * whose birthday it is.
 */
export function occasionTitle(item: SpecialDateItem): OccasionLabel {
  if (item.title !== null && item.title !== '') {
    return { key: 'home.occasion.custom', values: { title: item.title } };
  }

  const who = names(item);
  const ordinal = item.ordinal;

  switch (item.type) {
    case 'BIRTHDAY':
      return ordinal === null
        ? { key: 'home.occasion.birthday', values: { name: who } }
        : { key: 'home.occasion.birthdayAge', values: { name: who, count: ordinal } };
    case 'MEMORIAL':
      return ordinal === null
        ? { key: 'home.occasion.memorial', values: { name: who } }
        : { key: 'home.occasion.memorialYears', values: { name: who, count: ordinal } };
    case 'ANNIVERSARY':
      return ordinal === null
        ? { key: 'home.occasion.anniversary', values: { name: who } }
        : { key: 'home.occasion.anniversaryYears', values: { name: who, count: ordinal } };
    default:
      // `CUSTOM` with no title should not happen — the server stores one —
      // but a blank card is a worse answer than a plain one.
      return { key: 'home.occasion.generic', values: { name: who } };
  }
}

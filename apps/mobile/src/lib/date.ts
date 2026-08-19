import i18next from '../i18n';

/**
 * Formatting for the DATE columns the API returns (`YYYY-MM-DD`).
 *
 * These are parsed by hand rather than through `new Date()`: a bare date
 * string is treated as UTC midnight, so any device west of UTC renders the
 * day before. Birthdays and death dates cannot be allowed to drift.
 *
 * The month name and the order of the parts both come from the catalogue,
 * because neither survives translation: Japanese writes the month before the
 * day and marks each part with a counter word.
 *
 * `i18next.t` rather than the hook — these are plain functions, and every
 * component that calls them already re-renders on a language change through
 * its own `useTranslation()`.
 */
type DateParts = { year: string; month: string; day: number };

/**
 * The calendar day, whether the server sent one or a whole timestamp.
 *
 * DATE columns come back as `1968-04-12T00:00:00.000Z` even where the
 * contract calls them date-only — the ground rule in `api-contract.md` says
 * every date crosses the wire as an ISO string and has to be cut down. Doing
 * that here rather than at each call site is the difference between one place
 * to get it right and a silent `NaN` that erases the day from a timeline.
 *
 * Cut, never converted: `new Date(...)` on a UTC midnight renders the day
 * before anywhere west of Greenwich, which is exactly what a birthday must
 * never do.
 *
 * Exported because display is not the only place it is needed: a form field
 * that edits a DATE has to be *seeded* with the day too. Putting the server's
 * `1964-03-14T00:00:00.000Z` straight into a `YYYY-MM-DD` input is what put
 * the profile editor into a permanent "wrong format" error.
 */
export function dayOnly(value: string): string {
  return value.length > 10 ? value.slice(0, 10) : value;
}

function parse(isoDate: string): DateParts | null {
  const [year, month, day] = dayOnly(isoDate).split('-');
  if (year === undefined || month === undefined || day === undefined) return null;

  const index = Number(month);
  if (!Number.isInteger(index) || index < 1 || index > 12) return null;
  if (Number.isNaN(Number(day))) return null;

  return { year, month: i18next.t(`date.months.${index}`), day: Number(day) };
}

/** `1968-04-12` → `12 Apr`. Null when the input is not a plain date. */
export function formatDayMonth(isoDate: string): string | null {
  const parts = parse(isoDate);
  return parts === null ? null : i18next.t('date.dayMonth', parts);
}

/** `1968-04-12` → `12 Apr 1968`. */
export function formatFullDate(isoDate: string): string | null {
  const parts = parse(isoDate);
  return parts === null ? null : i18next.t('date.fullDate', parts);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How long ago, as a catalogue key plus a count — never as a finished string.
 *
 * The caller does `t(key, { count })` so the number goes through i18next
 * plurals. Building the sentence here would mean choosing between "1 day" and
 * "2 days" in code, and Japanese has no plural form to choose between.
 *
 * Buckets rather than exact arithmetic: past a week nobody reads "9 days ago"
 * as anything more precise than "last week", and a memo written in March does
 * not become more useful for being dated to the hour.
 */
export function relativeTime(isoDate: string): { key: string; count: number } | null {
  // Compare calendar days, not instants: a note written last night is
  // "yesterday" at 9am, not "14 hours ago".
  const [year, month, day] = dayOnly(isoDate).split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || !Number.isInteger(day)) return null;

  const then = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const days = Math.round((today - then) / DAY_MS);

  // A date in the future is a fixture typo or a clock skew, not a state the
  // screen should try to phrase. Fall back to the plain date.
  if (days < 0) return null;
  if (days === 0) return { key: 'date.relative.today', count: 0 };
  if (days === 1) return { key: 'date.relative.yesterday', count: 1 };
  if (days < 7) return { key: 'date.relative.daysAgo', count: days };
  if (days < 30) return { key: 'date.relative.weeksAgo', count: Math.floor(days / 7) };
  if (days < 365) return { key: 'date.relative.monthsAgo', count: Math.floor(days / 30) };
  return { key: 'date.relative.yearsAgo', count: Math.floor(days / 365) };
}

/**
 * Whole days from today until `isoDate`, or null once it has passed.
 *
 * The mirror of `relativeTime`, which deliberately refuses a future date. An
 * invitation is the one thing in the app that points forwards, and "expires
 * in 3 days" is the only part of it the sender can still act on.
 *
 * Calendar days again, not elapsed hours: an invitation that lapses tomorrow
 * morning should not read "in 0 days" tonight.
 */
export function daysUntil(isoDate: string): number | null {
  const [year, month, day] = dayOnly(isoDate).split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || !Number.isInteger(day)) return null;

  const then = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const days = Math.round((then - today) / DAY_MS);
  return days < 0 ? null : days;
}

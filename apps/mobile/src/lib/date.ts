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

function parse(isoDate: string): DateParts | null {
  const [year, month, day] = isoDate.split('-');
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

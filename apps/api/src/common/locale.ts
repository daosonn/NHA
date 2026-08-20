/**
 * The languages the app ships copy in (`apps/mobile/src/locales/`), and
 * the only values that may be handed to the AI service — its contract
 * names `en` / `ja` / `vi` explicitly (docs/03-ai/architecture.md).
 */
export const SUPPORTED_LOCALES = ['en', 'ja', 'vi'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

/**
 * First usable locale among the candidates, in priority order — typically
 * the request's own field, then `User.locale`, then the default.
 *
 * `User.locale` is a plain nullable string with no constraint at the
 * column, so **nothing guarantees it holds a supported value**: today no
 * code writes it at all, but a Settings screen storing a device locale
 * would put `"ja-JP"` (or worse) there, and it would travel straight to
 * the AI service. A region subtag is honoured by its primary language —
 * `ja-JP` is Japanese — and anything still unrecognised falls back rather
 * than being forwarded.
 */
export function resolveLocale(
  ...candidates: (string | null | undefined)[]
): SupportedLocale {
  for (const candidate of candidates) {
    const primary = candidate?.trim().toLowerCase().split(/[-_]/)[0];
    const match = SUPPORTED_LOCALES.find((locale) => locale === primary);
    if (match) {
      return match;
    }
  }
  return DEFAULT_LOCALE;
}

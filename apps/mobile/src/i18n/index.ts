import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import ja from '../locales/ja.json';

/**
 * Locales the app ships.
 *
 * Japanese renders in the device's own font for now: Inter and Lora have no
 * Japanese glyphs, and Zen Maru Gothic + Noto Sans JP are ~30–50 MB of TTF
 * that has not been paid for yet. `theme/typeface.ts` does the swap and
 * keeps the weight scale working; `docs/01-frontend/design-system.md`
 * records what bundling them will change.
 */
export const SUPPORTED_LOCALES = ['en', 'ja'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const FALLBACK_LOCALE: Locale = 'en';

function isSupported(code: string | null): code is Locale {
  return code !== null && (SUPPORTED_LOCALES as readonly string[]).includes(code);
}

/** How each language names itself. Never translated — a language picker is
 * read by someone who cannot yet read the language they are leaving. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
};

/** The first language the device asks for that the app actually speaks. */
export function deviceLocale(): Locale {
  for (const locale of getLocales()) {
    if (isSupported(locale.languageCode)) return locale.languageCode;
  }

  return FALLBACK_LOCALE;
}

void i18next.use(initReactI18next).init({
  resources: { en: { translation: en }, ja: { translation: ja } },
  lng: deviceLocale(),
  fallbackLng: FALLBACK_LOCALE,
  // React escapes for us; i18next's HTML escaping would double-encode.
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { isSupported };
export default i18next;

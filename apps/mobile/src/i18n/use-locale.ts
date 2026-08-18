import { useSyncExternalStore } from 'react';

import i18next, { FALLBACK_LOCALE, isSupported, type Locale } from './index';

/**
 * The active language, as a value a component can render from.
 *
 * `useTranslation()` already re-renders on a language change, but only for
 * components that call `t()`. Plenty of them draw nothing but data — a name,
 * a photo count — and still have to change type face when the language does,
 * so they need the language itself rather than a translation of it.
 *
 * A store subscription rather than the i18n context: this is read by `Text`,
 * which is on every screen many times over, and the whole state is one
 * string.
 */
function subscribe(onChange: () => void): () => void {
  i18next.on('languageChanged', onChange);
  return () => i18next.off('languageChanged', onChange);
}

function read(): Locale {
  const active = i18next.resolvedLanguage ?? null;
  return isSupported(active) ? active : FALLBACK_LOCALE;
}

export function useLocale(): Locale {
  // The server snapshot is the same read: i18next is initialised at import
  // time, so prerendering sees a real language rather than a placeholder.
  return useSyncExternalStore(subscribe, read, read);
}

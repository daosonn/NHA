import AsyncStorage from '@react-native-async-storage/async-storage';

import i18next, { deviceLocale, FALLBACK_LOCALE, isSupported, type Locale } from './index';

const KEY = 'nha.locale';

/**
 * Which language to show, in order: what the person chose, then what the
 * device asks for, then English.
 *
 * The choice is a preference, not a secret, so `AsyncStorage` is right here
 * — `expo-secure-store` is for tokens and has a size limit besides.
 */
export async function restoreLocale(): Promise<Locale> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (isSupported(stored)) {
      await i18next.changeLanguage(stored);
      return stored;
    }
  } catch {
    // A readable app in the wrong language beats no app: fall through to
    // the device default rather than letting storage break the launch.
  }

  return deviceLocale();
}

export async function setLocale(locale: Locale): Promise<void> {
  await i18next.changeLanguage(locale);

  try {
    await AsyncStorage.setItem(KEY, locale);
  } catch {
    // The language still changed for this session; it just will not be
    // remembered. Not worth failing the interaction over.
  }
}

export function currentLocale(): Locale {
  const active = i18next.resolvedLanguage ?? null;
  return isSupported(active) ? active : FALLBACK_LOCALE;
}

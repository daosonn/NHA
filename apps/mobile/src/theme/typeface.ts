import type { TextStyle } from 'react-native';

import { useLocale } from '../i18n/use-locale';
import { fonts } from './index';

export type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

const SANS: Record<Weight, string> = {
  regular: fonts.regular,
  medium: fonts.medium,
  semibold: fonts.semibold,
  bold: fonts.bold,
};

/** Lora ships no regular weight here — medium is the lightest it goes. */
const SERIF: Record<Weight, string> = {
  regular: fonts.serifMedium,
  medium: fonts.serifMedium,
  semibold: fonts.serifSemiBold,
  bold: fonts.serifBold,
};

const SYSTEM_WEIGHT: Record<Weight, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

/**
 * Languages the bundled faces can actually draw.
 *
 * Inter and Lora are Latin-only. Asking them for a kanji gets tofu on
 * Android and a silent per-glyph substitution on iOS — which is worse than
 * it sounds, because the substituted face has different metrics and the
 * line ends up a different height from the one beside it.
 */
const LATIN_FACES = new Set(['en']);

/**
 * Which face to draw text in, for the language on screen.
 *
 * Outside the Latin languages this hands back the system face and a real
 * `fontWeight`. Synthetic bolding is only missing for *custom* families —
 * the platform's own font has genuine weights — so the scale survives the
 * swap even though the shapes change.
 *
 * This is the interim until Zen Maru Gothic and Noto Sans JP are bundled;
 * see `docs/01-frontend/design-system.md`.
 */
export function useTypeface(weight: Weight, serif = false): TextStyle {
  const locale = useLocale();

  if (!LATIN_FACES.has(locale)) {
    return { fontWeight: SYSTEM_WEIGHT[weight] };
  }

  return { fontFamily: serif ? SERIF[weight] : SANS[weight] };
}

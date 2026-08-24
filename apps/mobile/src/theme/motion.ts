import { Easing, FadeIn, FadeOut, FadeOutDown, Keyframe } from 'react-native-reanimated';
import { motion } from '@nha/tokens';

/**
 * The motion spec (`docs/01-frontend/motion/nha-motion.css`) translated for
 * Reanimated. Screens import presets from here — never build a one-off
 * `FadeInDown.duration(250)` inline, for the same reason nobody types a
 * hex color: the vocabulary is the system.
 *
 * Reduced motion needs no handling here: Reanimated defaults every
 * animation to `ReduceMotion.System`, so the OS setting collapses all of
 * these on its own.
 */

export const duration = motion.duration;
export const stagger = motion.stagger;

export const easing = {
  settle: Easing.bezier(...motion.easing.settle),
  bounce: Easing.bezier(...motion.easing.bounce),
  snap: Easing.bezier(...motion.easing.snap),
} as const;

/** Scale for anything pressable while pressed (`.nha-press`). */
export const PRESS_SCALE = 0.955;

/** Cards and rows dip less than buttons (`.nha-card:active`). */
export const CARD_PRESS_SCALE = 0.99;

/**
 * Content entering a screen. Pass the item's index and siblings arrive
 * staggered (`.nha-enter`, `--stagger`); omit it for a lone element.
 */
export const enter = {
  /** `nhaFadeUp` — rises 16px while fading in. The default entrance. */
  up: (index = 0) =>
    new Keyframe({
      0: { opacity: 0, transform: [{ translateY: 16 }] },
      100: { opacity: 1, transform: [{ translateY: 0 }], easing: easing.settle },
    })
      .duration(duration.enter)
      .delay(index * stagger),
  /** `nhaFadeIn` — opacity only, for things that must not move. */
  fade: (index = 0) =>
    FadeIn.duration(duration.enter)
      .easing(easing.settle)
      .delay(index * stagger),
} as const;

/** Leaving is quicker than arriving — nothing to read on the way out. */
export const exit = {
  fade: FadeOut.duration(duration.select).easing(easing.snap),
  down: FadeOutDown.duration(duration.select).easing(easing.snap),
} as const;

/**
 * `nhaToast` — rises with a small overshoot before settling. The bounce
 * lives in the keyframes, so the easing between them stays `settle`.
 */
export const toastIn = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 18 }, { scale: 0.96 }] },
  60: { opacity: 1, transform: [{ translateY: -3 }, { scale: 1.01 }], easing: easing.settle },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: easing.settle },
}).duration(duration.sheet);

/**
 * `nhaPop` — a tick or heart appearing: springs past full size and back.
 * For state flips inside a control (checkbox, reaction), not entrances.
 */
export const pop = new Keyframe({
  0: { transform: [{ scale: 0.72 }] },
  60: { transform: [{ scale: 1.12 }], easing: easing.settle },
  100: { transform: [{ scale: 1 }], easing: easing.settle },
}).duration(duration.select);

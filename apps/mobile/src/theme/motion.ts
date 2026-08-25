import { Platform } from 'react-native';
import {
  BounceIn,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  Keyframe,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
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

/** `.nha-tick` — the mark springs in over 260ms while opacity leads at 160. */
export const tickTiming = { scaleMs: 260, fadeMs: 160 } as const;

/**
 * On web, a custom `Keyframe` entrance breaks layout after it finishes:
 * Reanimated (4.5) schedules a cleanup for every animation name it does not
 * recognise, and that cleanup pins the element `position: absolute` at a
 * snapshot (`layoutReanimation/web/componentUtils.js`, the
 * `!(animationName in Animations)` branch). Out of flow, the element's list
 * cell collapses to 0 and later rows draw on top of earlier ones. The
 * predefined builders (`FadeIn`, `FadeInDown`, …) are in that `Animations`
 * table and skip the broken path — so web gets the nearest predefined
 * equivalent, native keeps the exact spec keyframes.
 */
const WEB = Platform.OS === 'web';

/**
 * Content entering a screen. Pass the item's index and siblings arrive
 * staggered (`.nha-enter`, `--stagger`); omit it for a lone element.
 */
export const enter = {
  /** `nhaFadeUp` — rises 16px while fading in. The default entrance. */
  up: (index = 0) =>
    WEB
      ? FadeInDown.duration(duration.enter)
          .easing(easing.settle)
          .delay(index * stagger)
      : new Keyframe({
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

/**
 * Content swapped in place — a tab or filter replacing a panel. Select-speed
 * (`--dur-select`) and no travel: the reader has not gone anywhere, only the
 * panel has, so the 520ms rise of `enter` would read as a page load.
 */
export const swapIn = FadeIn.duration(duration.select).easing(easing.snap);

/** Leaving is quicker than arriving — nothing to read on the way out. */
export const exit = {
  fade: FadeOut.duration(duration.select).easing(easing.snap),
  down: FadeOutDown.duration(duration.select).easing(easing.snap),
} as const;

/**
 * `.nha-screen` for the native stack — spread into a `Stack`'s
 * `screenOptions`. The native push *is* the spec's motion (incoming slides
 * from the right, the outgoing screen parallaxes behind at reduced
 * opacity), so this configures rather than reimplements it. The duration
 * is honored on iOS; Android keeps its system curve, and web does not
 * animate route changes at all — the spec's `.nha-screen` classes exist
 * for the web demo, not for `react-native-screens`.
 */
export const screenTransition = {
  animation: 'slide_from_right',
  animationDuration: duration.screen,
} as const;

/**
 * `.nha-sheet` / `.nha-scrim` — the panel rises from the bottom edge while
 * the scrim fades beside it, 320ms both ways (the spec gives the sheet one
 * transition for both directions). Predefined builders only: web-safe.
 * Used through `components/ui/sheet-modal.tsx`, not spread by hand.
 */
export const sheet = {
  in: SlideInDown.duration(duration.sheet).easing(easing.settle),
  out: SlideOutDown.duration(duration.sheet).easing(easing.settle),
  scrimIn: FadeIn.duration(duration.sheet).easing(easing.settle),
  scrimOut: FadeOut.duration(duration.sheet).easing(easing.settle),
} as const;

/**
 * `nhaToast` — rises with a small overshoot before settling. The bounce
 * lives in the keyframes, so the easing between them stays `settle`.
 * Web loses the overshoot (predefined rise only — see the WEB note above).
 */
export const toastIn = WEB
  ? FadeInDown.duration(duration.sheet).easing(easing.settle)
  : new Keyframe({
      0: { opacity: 0, transform: [{ translateY: 18 }, { scale: 0.96 }] },
      60: { opacity: 1, transform: [{ translateY: -3 }, { scale: 1.01 }], easing: easing.settle },
      100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: easing.settle },
    }).duration(duration.sheet);

/**
 * `nhaPop` as an entrance — something small arriving: an interest chip, a
 * badge. Springs past full size and back over 320ms (the chip-input demo,
 * `docs/01-frontend/motion/chip-input-merged.html`). Web gets the predefined
 * `BounceIn` (same spirit, safe path — see the WEB note above); for state
 * flips inside a control, the imperative twin `usePop` stays the tool.
 */
export const pop = WEB
  ? BounceIn.duration(duration.sheet)
  : new Keyframe({
      0: { transform: [{ scale: 0.72 }] },
      60: { transform: [{ scale: 1.12 }], easing: easing.settle },
      100: { transform: [{ scale: 1 }], easing: easing.settle },
    }).duration(duration.sheet);

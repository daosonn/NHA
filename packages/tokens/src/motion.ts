/**
 * Motion tokens — the app's timing vocabulary.
 *
 * Source of truth: the approved motion spec from Claude Design
 * (`docs/01-frontend/motion/nha-motion.css`, 2026-08-24). Durations are in ms and
 * named for the *moment* they belong to, not their length, so a screen
 * never hardcodes "320" — it says `sheet` and stays correct when the scale
 * is retuned. Easings are cubic-bezier control points; each client builds
 * its own curve object from the same four numbers (Reanimated via
 * `Easing.bezier`, web CSS via `cubic-bezier()`).
 */
export const motion = {
  duration: {
    /** Press feedback, hover. */
    press: 120,
    /** Selection state: tabs, chips, checkboxes. */
    select: 200,
    /** Sheets, modals, toasts. */
    sheet: 320,
    /** Screen-to-screen transitions. */
    screen: 420,
    /** Content entering a screen. */
    enter: 520,
  },
  /** Delay step between staggered siblings (item i waits i × this). */
  stagger: 55,
  easing: {
    /** The default — decelerates into place. */
    settle: [0.22, 1, 0.36, 1],
    /** Playful overshoot — ticks, toasts, tab underlines. */
    bounce: [0.34, 1.56, 0.64, 1],
    /** Presses and color changes — quick, symmetric. */
    snap: [0.4, 0, 0.2, 1],
  },
} as const;

export type Motion = typeof motion;

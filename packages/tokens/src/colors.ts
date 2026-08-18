/**
 * NHA color palette.
 *
 * Coral is the only accent. It is reserved for the primary button, the
 * active nav tab, the "You" node in the family tree, badges and the active
 * timeline node — never for decoration.
 *
 * Source of truth: docs/01-frontend/design-system.md
 */
export const colors = {
  /** Page and surface backgrounds. */
  background: {
    page: '#FAF9F8',
    card: '#FFFFFF',
    subtle: '#F4F2EF',
    muted: '#F4F4F5',
    surfaceSoft: '#FBFAF9',
    /** Translucent page color used by the blurred header. */
    headerBlur: '#FAF9F8B8',
  },

  /** Text and foreground content. */
  text: {
    primary: '#18181B',
    secondary: '#52525B',
    /** Descriptive body copy inside cards — one step lighter than secondary. */
    body: '#71717A',
    muted: '#8A857E',
    subtle: '#A6968F',
    lightMuted: '#A1A1AA',
    white: '#FFFFFF',
  },

  /** Brand accent. */
  coral: {
    /** Fills: primary button, active tab pill, FAB. */
    primary: '#F58B7B',
    /** Strokes, rings and thin marks. */
    brand: '#F0705F',
    /** Primary button pressed state. */
    dark: '#E4776A',
    /** Text on a coral tint. */
    deep: '#B8422F',
    hover: '#DE5947',

    light: '#FDE7E2',
    soft: '#FEF3F1',
    subtle: '#FFF6F3',

    border: '#F5A497',
    borderLight: '#EFB0A3',
    borderSoft: '#E9AFA3',
  },

  /** Category themes for memo tags and event widgets. */
  themes: {
    hobbies: { bg: '#E4F3EA', text: '#2F6B4F', dot: '#4B9E74', accent: '#7FB78F' },
    health: { bg: '#ECE9FA', text: '#4B3F9E', dot: '#7C6FD6' },
    gift: { bg: '#FCE6EE', text: '#9D2C55', dot: '#D4608A' },
    memories: { bg: '#FBF0DA', text: '#8A5A12', dot: '#C79331', accent: '#F5C04E' },
    todo: { bg: '#E3EFFA', text: '#1F5B87', dot: '#4A8FC0' },
    destructive: {
      bg: '#FBEAEA',
      text: '#C13B3B',
      solid: '#D14343',
      press: '#B93A3A',
      border: '#EFB4B4',
    },
  },

  /** Shared UI states. Disabled is always neutral — never a faded coral. */
  state: {
    disabledBg: '#F1EFEC',
    disabledText: '#B5B1AB',
    disabledBorder: '#E7E5E2',
    /** Ghost button pressed. */
    pressOverlay: 'rgba(24,24,27,0.06)',
    borderDefault: 'rgba(24,24,27,0.06)',
    borderStrong: 'rgba(24,24,27,0.08)',
    /** Visible hairline on a white surface: neutral buttons, list rows. */
    borderNeutral: '#E7E1DC',
    /** Dashed outline of an "add here" affordance. */
    borderDashed: '#C6C2BC',
    scrim: 'rgba(24,24,27,0.28)',
  },
} as const;

export type Colors = typeof colors;

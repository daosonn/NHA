/**
 * Typography.
 *
 * Inter carries all UI text. Lora is reserved for emotional headings and
 * year tags ("Dad's journey", "1998") — never for controls.
 *
 * The mockups were drawn in Be Vietnam Pro. The product ships English
 * first and Japanese second, and Be Vietnam Pro has no Japanese glyphs, so
 * Inter replaces it — visually near-identical at these sizes. When
 * Japanese lands, add Noto Sans JP as the fallback rather than swapping
 * the primary face.
 */
export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, sans-serif',
    serif: 'Lora, Georgia, serif',
    mono: 'ui-monospace, Menlo, monospace',
  },

  /** React Native needs the postscript name per weight. */
  fontFamilyNative: {
    sansRegular: 'Inter_400Regular',
    sansMedium: 'Inter_500Medium',
    sansSemiBold: 'Inter_600SemiBold',
    sansBold: 'Inter_700Bold',
    serifMedium: 'Lora_500Medium',
    serifSemiBold: 'Lora_600SemiBold',
    /** The NHA wordmark. */
    serifBold: 'Lora_700Bold',
  },

  fontSize: {
    badge: { fontSize: 10, lineHeight: 12 },
    caption: { fontSize: 12, lineHeight: 16 },
    body2: { fontSize: 13, lineHeight: 20 },
    body1: { fontSize: 15, lineHeight: 21 },
    subtitle: { fontSize: 17, lineHeight: 24 },
    h2: { fontSize: 20, lineHeight: 26 },
    h1: { fontSize: 24, lineHeight: 32 },
    display: { fontSize: 26, lineHeight: 34 },
  },

  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export type Typography = typeof typography;

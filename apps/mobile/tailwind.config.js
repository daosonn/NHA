/**
 * Tailwind is a *consumer* of the design tokens, never a second source of
 * truth. Every value here comes from `@nha/tokens`; adding a raw hex or a
 * one-off size to this file is a bug — add it to the package instead.
 *
 * `@nha/tokens` builds to CommonJS precisely so this file can require it.
 */
const { colors, radius, spacing, typography } = require('@nha/tokens');

/** `{ fontSize, lineHeight }` in px → Tailwind's `[size, lineHeight]` pairs. */
const fontSize = Object.fromEntries(
  Object.entries(typography.fontSize).map(([name, value]) => [
    name,
    [`${value.fontSize}px`, `${value.lineHeight}px`],
  ]),
);

/** Numeric px scale → Tailwind's string scale. */
const px = (scale) =>
  Object.fromEntries(Object.entries(scale).map(([name, value]) => [name, `${value}px`]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  // The palette is a fixed warm light one; dark styles must never come from the
  // OS setting. `class` also avoids a NativeWind web-dev crash: with the
  // default `media`, its stylesheet observer calls `colorScheme.set()`, which
  // throws for exactly that mode.
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        page: colors.background.page,
        card: colors.background.card,
        subtle: colors.background.subtle,
        muted: colors.background.muted,

        ink: colors.text.primary,
        secondary: colors.text.secondary,
        body: colors.text.body,
        soft: colors.text.muted,
        faint: colors.text.lightMuted,

        coral: {
          DEFAULT: colors.coral.primary,
          brand: colors.coral.brand,
          dark: colors.coral.dark,
          deep: colors.coral.deep,
          light: colors.coral.light,
          soft: colors.coral.soft,
          subtle: colors.coral.subtle,
          border: colors.coral.border,
        },

        hobbies: colors.themes.hobbies,
        health: colors.themes.health,
        gift: colors.themes.gift,
        memories: colors.themes.memories,
        todo: colors.themes.todo,
        danger: colors.themes.destructive,

        disabled: {
          bg: colors.state.disabledBg,
          text: colors.state.disabledText,
          border: colors.state.disabledBorder,
        },
        hairline: colors.state.borderDefault,
        dashed: colors.state.borderDashed,
      },

      // Named so they cannot collide with Tailwind's `font-bold` weight
      // utilities: React Native has no synthetic bolding, so a weight is a
      // different family, not a different `fontWeight`.
      fontFamily: {
        sans: [typography.fontFamilyNative.sansRegular],
        'sans-medium': [typography.fontFamilyNative.sansMedium],
        'sans-semibold': [typography.fontFamilyNative.sansSemiBold],
        'sans-bold': [typography.fontFamilyNative.sansBold],
        serif: [typography.fontFamilyNative.serifMedium],
        'serif-semibold': [typography.fontFamilyNative.serifSemiBold],
        'serif-bold': [typography.fontFamilyNative.serifBold],
      },

      fontSize,
      spacing: px(spacing),
      borderRadius: px(radius),
    },
  },
  plugins: [],
};

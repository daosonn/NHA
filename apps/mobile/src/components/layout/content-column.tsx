import { View, type ViewProps, type ViewStyle } from 'react-native';

import { layout, spacing } from '../../theme';

/**
 * The content column: full width up to a ceiling, then centred.
 *
 * This is the whole responsive strategy for everything below 1024px, and it
 * is deliberately not a breakpoint. Every screen used to be `viewport - two
 * gutters` wide at any size, so a phone layout simply grew: at 1440 a post
 * card was 1400px across. A ceiling fixes 600, 768, 1024 and 1440 in one
 * rule, and because the ceiling counts the gutters (React Native measures
 * `maxWidth` against the border box) a screen narrower than 600 is laid out
 * exactly as it was before — the phone design is untouched, not re-derived.
 *
 * Spread it into the `contentContainerStyle` of a scrollable rather than
 * wrapping the scrollable in a `View`: the scroll surface and its scrollbar
 * stay at the edge of the window, which is what a desktop reader expects,
 * while only the content inside is held to the column.
 */
export const contentColumn: ViewStyle = {
  width: '100%',
  maxWidth: layout.contentMaxWidth,
  alignSelf: 'center',
  paddingHorizontal: spacing.xl,
};

/**
 * The same column without the gutter, for a list whose rows own their side
 * padding — a separator, a row tint or a full-bleed photo grid has to reach
 * the column's edge, so the padding belongs to the row and not to the
 * container around it.
 */
export const contentColumnBleed: ViewStyle = {
  width: '100%',
  maxWidth: layout.contentMaxWidth,
  alignSelf: 'center',
};

export type ContentColumnProps = ViewProps & {
  /** Drop the side gutter, for content that carries its own. */
  bleed?: boolean;
};

/**
 * The column as a component, for the parts of a screen that do not scroll —
 * a pinned header row, a footer, a bar above the keyboard. Those need the
 * same ceiling as the content they sit against, or they drift apart from it
 * the moment the window is wider than the column.
 */
export function ContentColumn({ bleed = false, style, ...rest }: ContentColumnProps) {
  return <View style={[bleed ? contentColumnBleed : contentColumn, style]} {...rest} />;
}

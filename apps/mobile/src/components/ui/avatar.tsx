import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

import { colors, radius } from '../../theme';
import { PhotoPlaceholder } from './photo-placeholder';
import { Text } from './text';

/**
 * The tints a face can be drawn in.
 *
 * Borrowed from the category themes rather than invented, so an avatar can
 * never drift out of the palette. `destructive` is deliberately absent: it is
 * the colour of deleting something, and a person is not a warning.
 */
const FACE_THEMES = ['memories', 'hobbies', 'gift', 'health', 'todo'] as const;

/**
 * The same person is the same colour everywhere.
 *
 * Keyed off the name, not a render index, because the same face appears in
 * the tree, the feed, a comment and the album — and a colour that changed
 * between them would read as a different person.
 */
function faceTheme(seed: string) {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  const key = FACE_THEMES[sum % FACE_THEMES.length] ?? 'memories';
  return colors.themes[key];
}

/**
 * The letters that stand for a name: both ends of it.
 *
 * Which end holds the given name cannot be told from the string. Vietnamese
 * and Japanese write the family name first — Nguyễn Văn An, 山田 太郎 — but
 * plenty of Vietnamese users type their own name the other way round, and
 * this app has both in it. Either single-word rule therefore collapses for
 * half the cases: take the first word and a family who writes formally are
 * all "N"; take the last and a family who writes casually are all "N" too.
 *
 * Both ends is the way out. Whichever order the name is in, the given-name
 * initial is one of the two characters, so the faces stay distinct — NA / NM
 * / NH one way round, XN / MN / HN the other.
 *
 * `Array.from` rather than `charAt`: it splits by code point, so a name that
 * begins outside the Basic Multilingual Plane is not cut in half.
 */
function initials(name: string): string | null {
  const words = name.trim().split(/\s+/).filter(Boolean);

  const first = words[0];
  if (first === undefined) return null;

  const head = Array.from(first)[0] ?? '';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const tail = last === undefined ? '' : (Array.from(last)[0] ?? '');

  const letters = `${head}${tail}`.toLocaleUpperCase();
  return letters === '' ? null : letters;
}

export type AvatarProps = {
  size: number;
  /**
   * Whose face this is. Given, the avatar draws their initials on a tint
   * derived from the name; omitted, it falls back to the stripe placeholder
   * — which is right for decoration, and wrong for a real person.
   */
  name?: string;
  /** Only used by the stripe fallback. */
  tone?: 'light' | 'dark';
  /**
   * Ring drawn outside the circle, as a CSS box-shadow. Rings stack
   * (`0 0 0 2px #FFF, 0 0 0 4px #F0705F`), which a border cannot do, and they
   * must not shrink the image the way an inset border would.
   */
  ring?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A person.
 *
 * There are no photographs yet: `User.avatarKey` and `FamilyMember.avatarKey`
 * exist as columns, but no endpoint writes them and none serves them, so
 * there is nothing for this to load. Until then it draws their initials on a
 * colour of that person's own — which is the whole job an avatar does at this
 * size anyway. Every face used to be the same grey stripe pattern, so a tree
 * of nine people was nine identical blobs.
 *
 * When the upload lands this component grows one prop and nothing else
 * changes: every caller already says who it is drawing.
 */
export function Avatar({ size, name, tone = 'light', ring, style }: AvatarProps) {
  const letters = name === undefined ? null : initials(name);

  if (letters === null) {
    return (
      <PhotoPlaceholder
        tone={tone}
        period={10}
        style={[
          { width: size, height: size, borderRadius: radius.full },
          ring !== undefined && { boxShadow: ring },
          style,
        ]}
      />
    );
  }

  const theme = faceTheme(name ?? '');

  return (
    <View
      accessible
      // Announced as the person, not as "image": the letters are an
      // identifier, and a screen reader saying "N A" helps nobody.
      accessibilityLabel={name}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        ring !== undefined && { boxShadow: ring },
        style,
      ]}
    >
      <Text
        weight="semibold"
        color={theme.text}
        // Scaled off the circle rather than picked per call site, so one
        // component covers the 26px chip face and the 60px invite hero. Two
        // letters get the smaller step: a pair of CJK glyphs is twice as wide
        // as a pair of Latin ones and would otherwise touch the rim.
        style={{
          fontSize: size * (letters.length > 1 ? 0.33 : 0.42),
          lineHeight: size * (letters.length > 1 ? 0.4 : 0.5),
        }}
      >
        {letters}
      </Text>
    </View>
  );
}

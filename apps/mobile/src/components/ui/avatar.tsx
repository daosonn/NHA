import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

import { mediaSource } from '../../lib/media-source';
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
   * Their photograph, as a `Media` id — `ProfileDetail.avatarMediaId` or
   * `FamilyMemberSummary.avatarKey`. When there is one it wins; otherwise the
   * initials below stand in, which is most people most of the time.
   */
  mediaId?: string | null;
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
 * Three states, in order: a photograph if there is one, otherwise their
 * initials on a colour of their own, otherwise the stripe placeholder — which
 * is only right for decoration, never for a real person.
 *
 * The initials tier is not a stopgap. Most people will not upload a picture,
 * and "M" on a colour that is always theirs does the job an avatar does at
 * this size. Every face used to be the same grey stripe pattern, so a tree of
 * nine people was nine identical blobs.
 */
export function Avatar({ size, name, mediaId, tone = 'light', ring, style }: AvatarProps) {
  const letters = name === undefined ? null : initials(name);

  // Ảnh tải hỏng (401 lúc token xoay vòng, 404, rớt mạng) thì RƠI XUỐNG tầng
  // chữ cái đầu như thiết kế 3 tầng đã hứa — trước đây thiếu onError nên mặt
  // người thành một vòng tròn xám trống ở mọi nơi có avatar. `key` theo mediaId
  // để đổi người là trạng thái lỗi cũ tự về không.
  const [failed, setFailed] = useState(false);
  const failedFor = useRef<string | null>(null);

  if (mediaId != null && mediaId !== '' && !(failed && failedFor.current === mediaId)) {
    // The ring lives on a wrapper: `expo-image` takes an `ImageStyle`, which
    // has no `boxShadow`, and the rings this app draws stack two of them.
    return (
      <View
        accessible
        accessibilityLabel={name}
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius.full,
            overflow: 'hidden',
            backgroundColor: colors.background.subtle,
          },
          ring !== undefined && { boxShadow: ring },
          style,
        ]}
      >
        <Image
          source={mediaSource(mediaId)}
          recyclingKey={mediaId}
          contentFit="cover"
          transition={140}
          style={{ width: '100%', height: '100%' }}
          onError={() => {
            failedFor.current = mediaId;
            setFailed(true);
          }}
        />
      </View>
    );
  }

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

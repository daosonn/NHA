import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { CATEGORY_KEY } from '../../src/components/member/memo-card';
import { MediaStrip, type DraftMedia } from '../../src/components/moment/media-strip';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { getMemo, saveMemo } from '../../src/features/member/memo-store';
import type { GalleryItem, MemoCategory } from '../../src/fixtures/member';
import { colors, radius, spacing } from '../../src/theme';

const CATEGORIES: MemoCategory[] = ['gift', 'hobbies', 'health', 'memories', 'todo'];

const TITLE_MAX = 60;

/** Today as `YYYY-MM-DD`, which is what the fixtures and the API both use. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Photos already on the note become tiles without a `uri`, which is exactly
 * what `MediaStrip` draws as a striped placeholder — there is no real image
 * behind a fixture photo to show.
 */
function toDraft(photo: GalleryItem): DraftMedia {
  return { id: photo.id, kind: 'photo', tone: photo.tone };
}

function toPhoto(item: DraftMedia): GalleryItem {
  return { id: item.id, tone: item.tone };
}

/** One pill per category, coloured by its own theme when chosen. */
function CategoryPills({
  value,
  onChange,
}: {
  value: MemoCategory;
  onChange: (next: MemoCategory) => void;
}) {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 7, paddingRight: spacing.xl }}
    >
      {CATEGORIES.map((category) => {
        const theme = colors.themes[category];
        const active = category === value;

        return (
          <Pressable
            key={category}
            onPress={() => onChange(category)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={{
              height: 32,
              paddingHorizontal: 12,
              borderRadius: radius.full,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: active ? theme.bg : colors.background.card,
              boxShadow: active
                ? `inset 0 0 0 1.5px ${theme.dot}`
                : `inset 0 0 0 1px ${colors.state.borderDefault}`,
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: radius.full,
                backgroundColor: theme.dot,
              }}
            />
            <Text
              variant="caption"
              weight={active ? 'semibold' : 'medium'}
              color={active ? theme.text : colors.text.secondary}
            >
              {t(CATEGORY_KEY[category])}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * Write a note, or change one.
 *
 * One screen for both: to the person typing, adding a note and correcting one
 * are the same act, and `id` only decides what the fields start out holding
 * and which word the header uses.
 */
export default function MemoEditorScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, memberId } = useLocalSearchParams<{ id?: string; memberId: string }>();

  const existing = id === undefined ? null : getMemo(memberId, id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [category, setCategory] = useState<MemoCategory>(existing?.category ?? 'gift');
  const [photos, setPhotos] = useState<DraftMedia[]>(existing?.photos.map(toDraft) ?? []);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setPermissionDenied(true);
      return;
    }

    setPermissionDenied(false);

    // Photos only. A memo is a note with pictures attached to it, not a place
    // to keep video — that is what a moment is for.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    setPhotos((current) => [
      ...current,
      ...result.assets.map((asset, index) => ({
        id: asset.assetId ?? `${asset.uri}#${index}`,
        kind: 'photo' as const,
        tone: 'light' as const,
        uri: asset.uri,
      })),
    ]);
  };

  const ready = title.trim() !== '';

  const save = () => {
    if (!ready) return;

    const now = today();

    saveMemo(memberId, {
      id: existing?.id ?? `memo-${now}-${Math.round(Math.random() * 1e6)}`,
      title: title.trim(),
      body: body.trim() === '' ? null : body.trim(),
      category,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      photos: photos.map(toPhoto),
    });

    router.back();
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
            <Text variant="body1" weight="medium" color={colors.text.muted}>
              {t('member.memoEditor.cancel')}
            </Text>
          </Pressable>
        }
        center={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BrandMark size={22} />
            <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
              {existing === null
                ? t('member.memoEditor.titleNew')
                : t('member.memoEditor.titleEdit')}
            </Text>
          </View>
        }
        right={
          <Pressable
            onPress={save}
            disabled={!ready}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ready }}
            hitSlop={8}
          >
            <Text
              variant="body1"
              weight="semibold"
              color={ready ? colors.coral.deep : colors.state.disabledText}
            >
              {t('member.memoEditor.save')}
            </Text>
          </Pressable>
        }
        paddingRight={spacing.xl}
      />

      <ScrollView
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 40, gap: 12 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingLeft: spacing.xl }}>
          <CategoryPills value={category} onChange={setCategory} />
        </View>

        {/* Deliberately not wrapped in a `Card` like the mockup: `TextField`
            is already a white bordered surface, and nesting two of them in a
            third draws a box inside a box. Every other form in the app —
            auth, the invite sheet — stacks the fields the same way. */}
        <View style={{ paddingHorizontal: spacing.xl, gap: 14 }}>
          <TextField
            label={t('member.memoEditor.titleLabel')}
            value={title}
            onChangeText={setTitle}
            placeholder={t('member.memoEditor.titlePlaceholder')}
            maxLength={TITLE_MAX}
          />

          <TextField
            label={t('member.memoEditor.bodyLabel')}
            value={body}
            onChangeText={setBody}
            placeholder={t('member.memoEditor.bodyPlaceholder')}
            multiline
            numberOfLines={6}
          />

          <View style={{ gap: 6 }}>
            <Text variant="caption" weight="semibold" color={colors.text.secondary}>
              {t('member.memoEditor.photosLabel')}
            </Text>

            <MediaStrip
              media={photos}
              onAdd={() => void pick()}
              onRemove={(item) =>
                setPhotos((current) => current.filter((photo) => photo.id !== item.id))
              }
            />

            {permissionDenied && (
              <Text
                variant="caption"
                color={colors.themes.destructive.text}
                accessibilityRole="alert"
              >
                {t('moment.permissionDenied')}
              </Text>
            )}
          </View>

          {/* The mockup has a "Visible to the Nguyen family" row here. A memo
              is private to whoever wrote it (`docs/00-shared/domain-model.md`),
              so the screen states that instead of offering a choice that does
              not exist. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
            <Lock size={14} color={colors.text.subtle} strokeWidth={2} />
            <Text variant="caption" color={colors.text.subtle} style={{ flex: 1 }}>
              {t('member.memoEditor.private')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

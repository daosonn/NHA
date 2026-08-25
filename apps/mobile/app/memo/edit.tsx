import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { safeBack } from '../../src/lib/back';
import { ImageOff, Lock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumnBleed } from '../../src/components/layout/content-column';
import { ScreenTitle } from '../../src/components/layout/header-slots';
import {
  MEMO_CATEGORIES,
  categoryKey,
  type MemoCategory,
} from '../../src/components/member/memo-card';
import { NoteField } from '../../src/components/member/note-field';
import { MediaStrip, type DraftMedia } from '../../src/components/moment/media-strip';
import { Card } from '../../src/components/ui/card';
import { Text } from '../../src/components/ui/text';
import { useCreateMemo, useMemo, useUpdateMemo } from '../../src/features/member/use-memos';
import { ApiError, type MemoDetail } from '../../src/lib/api';
import { colors, radius, spacing } from '../../src/theme';

const TITLE_MAX = 120;
const CONTENT_MAX = 5000;

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
      {MEMO_CATEGORIES.map((category) => {
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
              {t(categoryKey(category))}
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
 * are the same act. Which it is comes from the params — `id` means an
 * existing note, `familyId` + `memberId` mean a new one about that person.
 */
export default function MemoEditorScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, familyId, memberId } = useLocalSearchParams<{
    id?: string;
    familyId?: string;
    memberId?: string;
  }>();

  const editing = id !== undefined;
  const existing = useMemo(editing ? id : null);

  if (editing && existing.isPending) {
    return (
      <View className="flex-1 bg-page">
        <AppHeader />
        <View style={{ paddingTop: 48, alignItems: 'center' }}>
          <ActivityIndicator color={colors.coral.primary} />
        </View>
      </View>
    );
  }

  return (
    <MemoEditorForm
      memo={existing.data ?? null}
      familyId={familyId ?? null}
      memberId={memberId ?? null}
      onDone={() => safeBack(router, '/')}
      onCancel={() => safeBack(router, '/')}
    />
  );
}

/**
 * Split out so the fields can be seeded with `useState` once the note has
 * loaded — a form whose initial values arrive after the first render either
 * needs this or an effect that fights the person typing.
 */
function MemoEditorForm({
  memo,
  familyId,
  memberId,
  onDone,
  onCancel,
}: {
  memo: MemoDetail | null;
  familyId: string | null;
  memberId: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  const create = useCreateMemo(familyId, memberId);
  const update = useUpdateMemo(memo?.id ?? null);
  const mutation = memo === null ? create : update;

  const [title, setTitle] = useState(memo?.title ?? '');
  const [content, setContent] = useState(memo?.content ?? '');
  const [category, setCategory] = useState<MemoCategory>(
    MEMO_CATEGORIES.find((value) => value === memo?.category) ?? 'gift',
  );
  const [photos, setPhotos] = useState<DraftMedia[]>([]);
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
        fileName: asset.fileName ?? `memo-${index}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
      })),
    ]);
  };

  const ready = title.trim() !== '';

  const save = () => {
    if (!ready) return;

    const trimmed = content.trim();

    if (memo === null) {
      create.mutate(
        {
          title: title.trim(),
          content: trimmed === '' ? undefined : trimmed,
          category,
          media: photos,
        },
        { onSuccess: onDone },
      );
      return;
    }

    update.mutate(
      {
        title: title.trim() === memo.title ? undefined : title.trim(),
        // `null` clears it on the server; `undefined` leaves it alone.
        content: trimmed === (memo.content ?? '') ? undefined : trimmed === '' ? null : trimmed,
        category: category === memo.category ? undefined : category,
      },
      { onSuccess: onDone },
    );
  };

  const errorKey =
    mutation.error === null
      ? null
      : mutation.error instanceof ApiError && mutation.error.isOffline
        ? 'errors.offline'
        : 'errors.generic';

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={
          <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={8}>
            <Text variant="body1" weight="medium" color={colors.text.muted}>
              {t('member.memoEditor.cancel')}
            </Text>
          </Pressable>
        }
        center={
          <ScreenTitle
            title={
              memo === null ? t('member.memoEditor.titleNew') : t('member.memoEditor.titleEdit')
            }
          />
        }
        right={
          <Pressable
            onPress={save}
            disabled={!ready || mutation.isPending}
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
        contentContainerStyle={{
          ...contentColumnBleed,
          paddingTop: 14,
          paddingBottom: 40,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingLeft: spacing.xl }}>
          <CategoryPills value={category} onChange={setCategory} />
        </View>

        {/* Mockup 1f: the note is one card you write on, not a stack of form
            fields. The inputs are borderless because the card is already the
            surface — see `note-field.tsx`. */}
        <View style={{ paddingHorizontal: spacing.xl, gap: 12 }}>
          <Card padding={18} style={{ gap: 14 }}>
            <NoteField
              weight="bold"
              fontSize={21}
              lineHeight={28}
              letterSpacing={-0.4}
              value={title}
              onChangeText={setTitle}
              placeholder={t('member.memoEditor.titlePlaceholder')}
              maxLength={TITLE_MAX}
              accessibilityLabel={t('member.memoEditor.titleLabel')}
              autoFocus={memo === null}
            />

            <View style={{ height: 1, backgroundColor: colors.background.subtle }} />

            <NoteField
              weight="regular"
              fontSize={15}
              lineHeight={25}
              value={content}
              onChangeText={setContent}
              placeholder={t('member.memoEditor.bodyPlaceholder')}
              maxLength={CONTENT_MAX}
              accessibilityLabel={t('member.memoEditor.bodyLabel')}
            />

            {memo === null ? (
              <>
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
              </>
            ) : (
              // Attachments are fixed at creation, the same rule posts and
              // life events follow. Said out loud rather than shown as a
              // picker that would throw the pictures away on save.
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <ImageOff size={14} color={colors.text.subtle} strokeWidth={2} />
                <Text variant="caption" color={colors.text.subtle} style={{ flex: 1 }}>
                  {t('member.memoEditor.photosFixed', { count: memo.media.length })}
                </Text>
              </View>
            )}
          </Card>

          {errorKey !== null && (
            <Text
              variant="caption"
              color={colors.themes.destructive.text}
              accessibilityRole="alert"
            >
              {t(errorKey)}
            </Text>
          )}

          {/* Where 1f puts "Visible to the Nguyen family · Change". A memo is
              private to whoever wrote it, so this states the fact rather than
              offering a choice that does not exist. */}
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

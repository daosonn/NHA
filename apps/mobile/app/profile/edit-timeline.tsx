import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Images, Info, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { AnimatedPressable } from '../../src/components/motion/animated-pressable';
import { ScreenTitle } from '../../src/components/layout/header-slots';
import { MediaStrip, type DraftMedia } from '../../src/components/moment/media-strip';
import { Button } from '../../src/components/ui/button';
import { SheetModal } from '../../src/components/ui/sheet-modal';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useToast } from '../../src/components/ui/toast';
import { useLifeEvents } from '../../src/features/member/use-life-events';
import { useCommitMyTimeline } from '../../src/features/member/use-life-event-mutations';
import type { TimelineCommit } from '../../src/features/member/use-life-event-mutations';
import { EventPhotos } from '../../src/components/member/event-photos';
import type { PostMediaSummary } from '../../src/lib/api';
import { safeBack } from '../../src/lib/back';
import { dayOnly } from '../../src/lib/date';
import { thumbnailSource } from '../../src/lib/media-source';
import { colors, elevation, radius } from '../../src/theme';
import { enter } from '../../src/theme/motion';

/**
 * Màn 7's edit mode — the mockup `edit-timeline-view-edit.html` (now in
 * `docs/01-frontend/mockups/`): Cancel · Edit timeline · Done, an "Add an
 * entry" tile, pencil and trash on every card, new entries dimmed as drafts.
 *
 * Everything here is STAGED — the banner's promise is "changes are only
 * visible to you until Done", so the screen edits a local copy and the
 * server hears one batch when Done is tapped (`useCommitMyTimeline`).
 * Cancel simply leaves; the drafts die with the screen.
 *
 * Own timeline only for now: the edit link that leads here is drawn by
 * `editability === 'self'`, the recorded 2026-08-19 decision. The mockup
 * itself is drawn on Dad's page — opening this to placeholder (wiki)
 * profiles is the open product question in `project-status.md`, and this
 * screen is one `memberId` parameter away when the team decides.
 */

/** One entry as the screen holds it — server row or unsaved draft. */
type DraftEntry = {
  /** List identity: the server id, or a local `new-N`. */
  key: string;
  /** Null = not on the server yet. */
  id: string | null;
  title: string;
  description: string;
  place: string;
  /** Date-only `YYYY-MM-DD`. */
  eventDate: string;
  /**
   * A saved entry's photo count, display only — media is fixed at creation,
   * so an existing entry's photos are never edited here.
   */
  mediaCount: number;
  /** A saved entry's media rows, to DRAW its photos (never edited). */
  serverMedia: PostMediaSummary[];
  /**
   * A NEW entry's picked photos, still local files. Uploaded by Done, so an
   * abandoned draft leaves nothing on the server. Always empty on saved rows.
   */
  media: DraftMedia[];
  /** An existing entry with unsaved edits. */
  dirty: boolean;
};

/** The picker's asset as a draft tile — photos only on the timeline form. */
function toDraftPhoto(asset: ImagePicker.ImagePickerAsset, index: number): DraftMedia {
  return {
    // `assetId` is null on web and `uri` is a blob URL there; the uri still
    // works as a key because two picks produce two object URLs (new.tsx).
    id: asset.assetId ?? `${asset.uri}#${index}`,
    kind: 'photo',
    tone: 'light',
    uri: asset.uri,
    fileName: asset.fileName ?? `timeline-${index}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}

/** `1998` or `1998-06-12` — what the form's date field accepts. */
function parseWhen(raw: string): string | null {
  const value = raw.trim();
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

/** Sort a life oldest-first — the banner's "entries sort by year automatically". */
function inOrder(entries: DraftEntry[]): DraftEntry[] {
  return [...entries].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
}

export default function EditTimelineScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();

  const timeline = useLifeEvents({ own: true, familyId: null, memberId: null });
  const commit = useCommitMyTimeline();

  /** Null until the server rows arrive; then the local, staged copy. */
  const [drafts, setDrafts] = useState<DraftEntry[] | null>(null);
  /** Ids of existing entries staged for deletion. */
  const [removed, setRemoved] = useState<string[]>([]);
  /** The sheet: null closed, 'new' adding, else the key being edited. */
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const nextLocalKey = useRef(1);

  useEffect(() => {
    if (drafts !== null || timeline.data === undefined) return;
    setDrafts(
      timeline.data.map((event) => ({
        key: event.id,
        id: event.id,
        title: event.title,
        description: event.description ?? '',
        place: event.place ?? '',
        eventDate: dayOnly(event.eventDate),
        mediaCount: event.media.length,
        serverMedia: event.media,
        media: [],
        dirty: false,
      })),
    );
  }, [drafts, timeline.data]);

  const entries = drafts ?? [];
  const changed = removed.length > 0 || entries.some((entry) => entry.id === null || entry.dirty);

  const saveEntry = (
    key: string | 'new',
    fields: Omit<DraftEntry, 'key' | 'id' | 'mediaCount' | 'serverMedia' | 'dirty'>,
  ) => {
    setDrafts((current) => {
      const list = current ?? [];
      if (key === 'new') {
        return inOrder([
          ...list,
          {
            ...fields,
            key: `new-${nextLocalKey.current++}`,
            id: null,
            mediaCount: fields.media.length,
            serverMedia: [],
            dirty: false,
          },
        ]);
      }
      return inOrder(
        list.map((entry) =>
          entry.key === key
            ? {
                ...entry,
                ...fields,
                dirty: true,
                // Photos are editable only while the entry is unsaved; a
                // saved entry keeps its own count — its media never changes.
                mediaCount: entry.id === null ? fields.media.length : entry.mediaCount,
                media: entry.id === null ? fields.media : entry.media,
              }
            : entry,
        ),
      );
    });
    setEditingKey(null);
  };

  const removeEntry = (entry: DraftEntry) => {
    if (entry.id !== null) setRemoved((current) => [...current, entry.id as string]);
    setDrafts((current) => (current ?? []).filter((item) => item.key !== entry.key));
  };

  const done = () => {
    if (!changed) {
      safeBack(router, '/profile');
      return;
    }
    const payload: TimelineCommit = {
      removes: removed,
      updates: entries
        .filter((entry) => entry.id !== null && entry.dirty)
        .map((entry) => ({
          id: entry.id as string,
          body: {
            title: entry.title,
            eventDate: entry.eventDate,
            description: entry.description === '' ? null : entry.description,
            place: entry.place === '' ? null : entry.place,
          },
        })),
      creates: entries
        .filter((entry) => entry.id === null)
        .map((entry) => ({
          body: {
            title: entry.title,
            eventDate: entry.eventDate,
            ...(entry.description === '' ? {} : { description: entry.description }),
            ...(entry.place === '' ? {} : { place: entry.place }),
          },
          media: entry.media,
        })),
    };
    commit.mutate(payload, {
      onSuccess: () => {
        toast.success(t('member.editTimeline.saved'));
        safeBack(router, '/profile');
      },
      // A partial failure has landed some of the batch; the cache was
      // invalidated on settle, so reseed the drafts from what is now true
      // and let the person press Done again with the rest.
      onError: () => {
        setDrafts(null);
        setRemoved([]);
        toast.failure(t('member.editTimeline.saveFailed'));
      },
    });
  };

  const editing =
    editingKey === null || editingKey === 'new'
      ? null
      : (entries.find((entry) => entry.key === editingKey) ?? null);

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={
          <Pressable
            onPress={() => safeBack(router, '/profile')}
            disabled={commit.isPending}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text variant="body2" weight="semibold" color={colors.text.muted}>
              {t('member.editTimeline.cancel')}
            </Text>
          </Pressable>
        }
        center={<ScreenTitle title={t('member.editTimeline.title')} />}
        right={
          commit.isPending ? (
            <ActivityIndicator size="small" color={colors.coral.brand} />
          ) : (
            <Pressable onPress={done} accessibilityRole="button" hitSlop={8}>
              <Text variant="body2" weight="bold" color={colors.coral.deep}>
                {t('member.editTimeline.done')}
              </Text>
            </Pressable>
          )
        }
      />

      {drafts === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.coral.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ ...contentColumn, paddingTop: 14, paddingBottom: 28, gap: 14 }}
          showsVerticalScrollIndicator={false}
        >
          {/* The mockup's warm one-offs (#FFF6F3, #8A6F68): softer than
              coral.light on purpose — this is a note, not a highlight. */}
          <Animated.View
            entering={enter.up(0)}
            style={{
              borderRadius: radius.xl,
              backgroundColor: '#FFF6F3',
              paddingVertical: 12,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Info size={16} color={colors.coral.deep} strokeWidth={2.1} />
            <Text variant="caption" color="#8A6F68" style={{ flex: 1 }}>
              {t('member.editTimeline.banner')}
            </Text>
          </Animated.View>

          <AnimatedPressable
            entering={enter.up(1)}
            onPress={() => setEditingKey('new')}
            accessibilityRole="button"
            style={{
              height: 72,
              borderRadius: radius.lg,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: colors.state.borderDashed,
              backgroundColor: '#FFF9F7',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              paddingHorizontal: 16,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                backgroundColor: colors.background.card,
                borderWidth: 1.5,
                borderColor: '#F0C3B6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={18} color={colors.coral.dark} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="body2" weight="semibold" color={colors.coral.deep}>
                {t('member.editTimeline.addTitle')}
              </Text>
              <Text variant="badge" color="#B08278">
                {t('member.editTimeline.addSub')}
              </Text>
            </View>
          </AnimatedPressable>

          {/* The rail: the same thread the read view draws, so editing reads
              as the same timeline with its tools out. */}
          <Animated.View
            entering={enter.up(2)}
            style={{ position: 'relative', paddingLeft: 32, gap: 16 }}
          >
            <View
              style={{
                position: 'absolute',
                left: 5,
                top: 6,
                bottom: 0,
                width: 2,
                borderRadius: radius.full,
                backgroundColor: colors.state.borderStrong,
                opacity: 0.6,
              }}
            />

            {entries.map((entry, index) => (
              <EntryCard
                key={entry.key}
                entry={entry}
                latest={index === entries.length - 1}
                onEdit={() => setEditingKey(entry.key)}
                onRemove={() => removeEntry(entry)}
              />
            ))}
          </Animated.View>
        </ScrollView>
      )}

      {/* NOT remounted per target (a `key` here killed the slide-down exit —
          the SheetModal must outlive `visible` for `sheet.out` to play);
          the sheet reseeds its own fields whenever it opens. */}
      <EntrySheet
        visible={editingKey !== null}
        entry={editing}
        onClose={() => setEditingKey(null)}
        onSave={(fields) =>
          saveEntry(editingKey === 'new' ? 'new' : (editingKey as string), fields)
        }
      />
    </View>
  );
}

function EntryCard({
  entry,
  latest,
  onEdit,
  onRemove,
}: {
  entry: DraftEntry;
  latest: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();

  const isDraft = entry.id === null;
  const year = entry.eventDate.slice(0, 4);

  return (
    <View
      style={{
        borderRadius: radius['2xl'],
        backgroundColor: colors.background.card,
        padding: 14,
        gap: 8,
        opacity: isDraft ? 0.62 : 1,
      }}
    >
      {/* The dot on the rail — coral for the latest, like the read view. */}
      <View
        style={{
          position: 'absolute',
          left: -32,
          top: 16,
          width: 12,
          height: 12,
          borderRadius: radius.full,
          backgroundColor: colors.background.card,
          borderWidth: 3,
          borderColor: latest ? colors.coral.brand : colors.state.borderStrong,
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View
          style={{
            height: 24,
            paddingHorizontal: 10,
            borderRadius: radius.full,
            backgroundColor: isDraft ? '#F1EDE9' : '#FEF3F1',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            serif
            weight="semibold"
            color={isDraft ? colors.text.muted : colors.coral.deep}
            style={{ fontSize: 14, lineHeight: 16, letterSpacing: 0.8 }}
          >
            {year}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={t('member.editTimeline.editEntry', { title: entry.title })}
            hitSlop={8}
          >
            <Pencil size={17} color={colors.text.muted} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={t('member.editTimeline.removeEntry', { title: entry.title })}
            hitSlop={8}
          >
            <Trash2 size={17} color={colors.coral.hover} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      <Text variant="body1" weight="semibold">
        {entry.title}
      </Text>

      {entry.description !== '' && (
        <Text variant="body2" color={colors.text.body}>
          {entry.description}
        </Text>
      )}

      {/* The photos themselves, same layout as the read view — a saved
          entry draws its server media, a draft draws the picked files. */}
      <EventPhotos
        photos={
          entry.id === null
            ? entry.media
                .filter((item) => item.uri !== undefined)
                .map((item) => ({ key: item.id, source: { uri: item.uri as string } }))
            : entry.serverMedia.map((item) => ({
                key: item.id,
                source: thumbnailSource(item.id, item.mimeType),
              }))
        }
      />

      {isDraft && (
        <Text variant="badge" weight="medium" color={colors.text.lightMuted}>
          {t('member.editTimeline.draft')}
        </Text>
      )}
    </View>
  );
}

function EntrySheet({
  visible,
  entry,
  onClose,
  onSave,
}: {
  visible: boolean;
  /** Null = adding a new entry. */
  entry: DraftEntry | null;
  onClose: () => void;
  onSave: (fields: {
    title: string;
    description: string;
    place: string;
    eventDate: string;
    media: DraftMedia[];
  }) => void;
}) {
  const { t } = useTranslation();

  const [when, setWhen] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState('');
  const [media, setMedia] = useState<DraftMedia[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Photos attach only while the entry is unsaved — media is fixed at creation. */
  const photosEditable = entry === null || entry.id === null;

  // Reseed on every open: the sheet stays mounted between uses (its exit
  // animation needs that), so mount-time state would be one target stale.
  useEffect(() => {
    if (!visible) return;
    setWhen(entry?.eventDate ?? '');
    setTitle(entry?.title ?? '');
    setDescription(entry?.description ?? '');
    setPlace(entry?.place ?? '');
    setMedia(entry?.media ?? []);
    setPermissionDenied(false);
    setError(null);
  }, [visible, entry]);

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled) return;
    setMedia((current) => [...current, ...result.assets.map(toDraftPhoto)]);
  };

  const save = () => {
    const eventDate = parseWhen(when);
    if (eventDate === null) {
      setError('member.editTimeline.whenInvalid');
      return;
    }
    if (title.trim() === '') {
      setError('member.editTimeline.titleRequired');
      return;
    }
    onSave({
      title: title.trim(),
      description: description.trim(),
      place: place.trim(),
      eventDate,
      media,
    });
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      scrimLabel={t('member.editTimeline.closeScrim')}
      style={{ maxHeight: '92%' }}
    >
      {/* The panel chrome is the sheet's own job (`SheetModal` brings none) —
          same anatomy as the member sheet: rounded top, page background,
          grab handle, scrolling body. */}
      <View
        style={[
          {
            flexShrink: 1,
            borderTopLeftRadius: radius['7xl'],
            borderTopRightRadius: radius['7xl'],
            backgroundColor: colors.background.page,
            paddingTop: 10,
          },
          elevation.sheet,
        ]}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 44,
            height: 5,
            borderRadius: radius.full,
            backgroundColor: '#E2DCD7',
          }}
        />

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 34, gap: 12 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="subtitle" weight="semibold">
            {t(entry === null ? 'member.editTimeline.addTitle' : 'member.editTimeline.editTitle')}
          </Text>

          <TextField
            label={t('member.editTimeline.whenLabel')}
            value={when}
            onChangeText={(value) => {
              setWhen(value);
              setError(null);
            }}
            placeholder="1998 · 1998-06-12"
            hint={t('member.editTimeline.whenHint')}
          />

          <TextField
            label={t('member.editTimeline.titleLabel')}
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              setError(null);
            }}
            maxLength={200}
          />

          <TextField
            label={t('member.editTimeline.storyLabel')}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <TextField
            label={t('member.editTimeline.placeLabel')}
            value={place}
            onChangeText={setPlace}
            maxLength={200}
          />

          {/* The share-to-feed switch stood here until 2026-09-03: creating
              a milestone no longer writes a feed post at all (owner's call —
              a timeline edit is record-keeping, not news). */}
          {photosEditable ? (
            <View style={{ gap: 2 }}>
              <Text variant="caption" weight="semibold" color={colors.text.secondary}>
                {t('member.editTimeline.photosLabel')}
              </Text>
              <MediaStrip
                media={media}
                onAdd={() => void pick()}
                onRemove={(item) => setMedia((current) => current.filter((m) => m.id !== item.id))}
              />
              {permissionDenied && (
                <Text variant="caption" color={colors.themes.destructive.text}>
                  {t('moment.permissionDenied')}
                </Text>
              )}
            </View>
          ) : (
            /* A saved entry's photos cannot change (media is fixed at
               creation) — say so instead of drawing a picker that lies. */
            entry !== null &&
            entry.mediaCount > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Images size={13} color={colors.text.subtle} strokeWidth={2} />
                <Text variant="badge" color={colors.text.subtle} style={{ flex: 1 }}>
                  {t('member.editTimeline.photosFixed', { count: entry.mediaCount })}
                </Text>
              </View>
            )
          )}

          {error !== null && (
            <Text
              variant="caption"
              color={colors.themes.destructive.text}
              accessibilityRole="alert"
            >
              {t(error)}
            </Text>
          )}

          <Button label={t('member.editTimeline.save')} size="large" fullWidth onPress={save} />
        </ScrollView>
      </View>
    </SheetModal>
  );
}

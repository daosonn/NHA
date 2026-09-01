import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Images, Lock, Plus, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AlbumFormSheet } from '../../src/components/album/album-form-sheet';
import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Text } from '../../src/components/ui/text';
import { useToast } from '../../src/components/ui/toast';
import { useAlbums, useCreateAlbum } from '../../src/features/album/use-albums';
import type { AlbumSummary } from '../../src/lib/api';
import { imageThumbSource } from '../../src/lib/media-source';
import { colors, radius, spacing } from '../../src/theme';
import { enter } from '../../src/theme/motion';

const GRID_GAP = 12;

/** How many grid cells join the entrance cascade on first paint (Home's rule). */
const CASCADE_CELLS = 6;

function AlbumCard({ album, onPress }: { album: AlbumSummary; onPress: () => void }) {
  const { t } = useTranslation();

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ flex: 1, gap: 7 }}>
      <View
        style={{
          aspectRatio: 1,
          borderRadius: radius['3xl'],
          overflow: 'hidden',
          backgroundColor: colors.background.subtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {album.coverMediaId === null ? (
          // An album with no cover is not broken — it is either empty or
          // nobody has chosen one yet, and both look the same from here.
          <Images size={26} color={colors.text.lightMuted} strokeWidth={1.8} />
        ) : (
          <Image
            source={imageThumbSource(album.coverMediaId)}
            recyclingKey={album.coverMediaId}
            contentFit="cover"
            transition={160}
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </View>

      <View style={{ gap: 1 }}>
        <Text variant="body2" weight="semibold" numberOfLines={1}>
          {album.name}
        </Text>
        <Text variant="badge" color={colors.text.muted}>
          {t('albums.photoCount', { count: album.itemCount })}
        </Text>
      </View>
    </Pressable>
  );
}

/** The dashed tile that starts a new one. Always last, so the shelf grows forward. */
function NewAlbumTile({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('albums.create')}
      style={{ flex: 1, gap: 7 }}
    >
      <View
        style={{
          aspectRatio: 1,
          borderRadius: radius['3xl'],
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: colors.coral.borderSoft,
          backgroundColor: colors.coral.subtle,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.full,
            backgroundColor: colors.coral.light,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={19} color={colors.coral.deep} strokeWidth={2.2} />
        </View>
      </View>

      <Text variant="body2" weight="medium" color={colors.coral.deep}>
        {t('albums.create')}
      </Text>
    </Pressable>
  );
}

/**
 * Your own albums — screen for WBS 1.6.7.
 *
 * **Private, always.** Nothing here is shared with a family and nothing here
 * appears on a Life Profile; the server has no route that reads somebody
 * else's. The screen says so out loud, because a shelf of photographs that
 * looks like the family's shelf is a privacy surprise waiting to happen —
 * and the two are one tap apart.
 *
 * Not to be confused with the Album *tab* on a profile: that one is derived
 * from posts and life events and nobody curates it. This one is only what its
 * owner put here.
 */
export default function AlbumsScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();

  const albums = useAlbums();
  const create = useCreateAlbum();

  const [creating, setCreating] = useState(false);

  const open = (albumId: string) =>
    router.push({ pathname: '/albums/[id]', params: { id: albumId } });

  const list = albums.data ?? [];

  // Two columns, and the new-album tile counts as one of the cells so the
  // rows stay even — the same rule the memo grid follows.
  const cells: ({ kind: 'album'; album: AlbumSummary } | { kind: 'new' })[] = [
    ...list.map((album) => ({ kind: 'album' as const, album })),
    { kind: 'new' },
  ];
  const columns: (typeof cells)[] = [[], []];
  cells.forEach((cell, index) => columns[index % 2]?.push(cell));

  return (
    <View className="flex-1 bg-page">
      <AppHeader left={<BackButton />} center={<ScreenTitle title={t('albums.title')} />} />

      <ScrollView
        contentContainerStyle={{
          ...contentColumn,
          paddingTop: spacing.xl,
          paddingBottom: 40,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={enter.up(0)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}
        >
          <Lock size={13} color={colors.text.muted} strokeWidth={2} />
          <Text variant="caption" color={colors.text.muted} style={{ flex: 1 }}>
            {t('albums.private')}
          </Text>
        </Animated.View>

        {albums.isPending ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.coral.primary} />
          </View>
        ) : albums.isError ? (
          <EmptyState
            renderIcon={(props) => <TriangleAlert {...props} strokeWidth={2} />}
            title={t('albums.loadFailed')}
            actionLabel={t('home.retry')}
            onActionPress={() => void albums.refetch()}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: GRID_GAP }}>
            {columns.map((column, columnIndex) => (
              <View key={columnIndex} style={{ flex: 1, gap: 16 }}>
                {column.map((cell, rowIndex) => {
                  // The cell's position in the original shelf order (cells
                  // were dealt into columns by index % 2), so the cascade
                  // sweeps the grid left-to-right rather than down a column.
                  const cellIndex = rowIndex * 2 + columnIndex;
                  return (
                    <Animated.View
                      key={cell.kind === 'new' ? 'new' : cell.album.id}
                      entering={enter.up(cellIndex < CASCADE_CELLS ? 1 + cellIndex : 0)}
                    >
                      {cell.kind === 'new' ? (
                        <NewAlbumTile onPress={() => setCreating(true)} />
                      ) : (
                        <AlbumCard album={cell.album} onPress={() => open(cell.album.id)} />
                      )}
                    </Animated.View>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <AlbumFormSheet
        visible={creating}
        mode="create"
        saving={create.isPending}
        error={create.error}
        onClose={() => {
          setCreating(false);
          create.reset();
        }}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: (album) => {
              setCreating(false);
              toast.success(t('albums.toast.created'));
              open(album.id);
            },
          })
        }
      />
    </View>
  );
}

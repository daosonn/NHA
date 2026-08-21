import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ellipsis, ImagePlus, Star, Trash2, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';

import { AlbumFormSheet } from '../../src/components/album/album-form-sheet';
import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import type { DraftMedia } from '../../src/components/moment/media-strip';
import { Button } from '../../src/components/ui/button';
import { EmptyState } from '../../src/components/ui/empty-state';
import { Text } from '../../src/components/ui/text';
import {
  useAddAlbumPhotos,
  useAlbum,
  useDeleteAlbum,
  useRemoveAlbumItem,
  useUpdateAlbum,
} from '../../src/features/album/use-albums';
import { ApiError, type AlbumItemDetail } from '../../src/lib/api';
import { mediaSource } from '../../src/lib/media-source';
import { colors, elevation, radius, spacing } from '../../src/theme';

const COLUMNS = 3;
/**
 * Percentage columns with `space-between` gutters, so the grid is fluid from
 * a Mini to a Pro Max without measuring anything — the same rule the profile
 * gallery follows.
 */
const CELL = '32%';

function toDraft(asset: ImagePicker.ImagePickerAsset, index: number): DraftMedia {
  return {
    id: asset.assetId ?? `${asset.uri}#${index}`,
    kind: 'photo',
    tone: 'light',
    uri: asset.uri,
    fileName: asset.fileName ?? `album-${index}.jpg`,
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}

/** What you can do to one photograph once it is in an album. */
function ItemActions({
  item,
  isCover,
  onClose,
  onSetCover,
  onRemove,
}: {
  item: AlbumItemDetail | null;
  isCover: boolean;
  onClose: () => void;
  onSetCover: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal visible={item !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        style={{ flex: 1, backgroundColor: colors.state.scrim }}
      />

      <View
        style={[
          {
            borderTopLeftRadius: radius['7xl'],
            borderTopRightRadius: radius['7xl'],
            backgroundColor: colors.background.page,
            padding: 20,
            paddingBottom: 34,
            gap: 10,
          },
          elevation.sheet,
        ]}
      >
        <Button
          label={isCover ? t('albums.item.isCover') : t('albums.item.setCover')}
          variant="secondary"
          size="large"
          fullWidth
          disabled={isCover}
          onPress={onSetCover}
          renderIcon={({ size, color }) => <Star size={size} color={color} strokeWidth={2.1} />}
        />

        {/* "Remove", not "Delete": the file stays where it came from. The
            server is explicit that deleting album organisation never touches
            the media, and the word has to carry that. */}
        <Button
          label={t('albums.item.remove')}
          variant="destructive"
          size="large"
          fullWidth
          onPress={onRemove}
          renderIcon={({ size, color }) => <Trash2 size={size} color={color} strokeWidth={2.1} />}
        />

        <Button
          label={t('common.close')}
          variant="ghost"
          size="medium"
          fullWidth
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

/**
 * One personal album.
 *
 * Photographs get here by being picked and uploaded, not by being chosen out
 * of the family's shared pictures. That is the server's rule rather than a
 * design preference: `POST /me/albums/:id/items` accepts only media this
 * account uploaded, and nothing on the wire says who uploaded a given
 * picture — so an "add from the family photos" list could not tell in advance
 * which of them it was allowed to offer.
 */
export default function AlbumScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const album = useAlbum(id ?? null);
  const update = useUpdateAlbum(id ?? null);
  const addPhotos = useAddAlbumPhotos(id ?? null);
  const removeItem = useRemoveAlbumItem(id ?? null);
  const deleteAlbum = useDeleteAlbum();

  const [editing, setEditing] = useState(false);
  const [acting, setActing] = useState<AlbumItemDetail | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setPermissionDenied(true);
      return;
    }

    setPermissionDenied(false);

    // Photographs only. An album is a shelf of pictures; video belongs to the
    // moment it was taken in.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled) return;
    addPhotos.mutate(result.assets.map(toDraft));
  };

  const header = (title: string) => (
    <AppHeader
      left={<BackButton onPress={() => router.back()} />}
      center={<ScreenTitle title={title} />}
      right={
        album.data === undefined ? undefined : (
          <Pressable
            onPress={() => setEditing(true)}
            accessibilityRole="button"
            accessibilityLabel={t('albums.form.editTitle')}
            hitSlop={8}
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.full,
              backgroundColor: colors.background.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ellipsis size={18} color={colors.text.secondary} strokeWidth={2.2} />
          </Pressable>
        )
      }
      paddingRight={spacing.lg}
    />
  );

  if (album.isPending) {
    return (
      <View className="flex-1 bg-page">
        {header(t('albums.title'))}
        <View style={{ paddingTop: 48, alignItems: 'center' }}>
          <ActivityIndicator color={colors.coral.primary} />
        </View>
      </View>
    );
  }

  if (album.isError || album.data === undefined) {
    return (
      <View className="flex-1 bg-page">
        {header(t('albums.title'))}
        <EmptyState
          renderIcon={(props) => <TriangleAlert {...props} strokeWidth={2} />}
          title={t('albums.loadFailed')}
          actionLabel={t('home.retry')}
          onActionPress={() => void album.refetch()}
        />
      </View>
    );
  }

  const detail = album.data;
  const fillers = (COLUMNS - (detail.items.length % COLUMNS)) % COLUMNS;

  const busyKey =
    addPhotos.error !== null
      ? addPhotos.error instanceof ApiError && addPhotos.error.isOffline
        ? 'errors.offline'
        : 'errors.generic'
      : null;

  return (
    <View className="flex-1 bg-page">
      {header(detail.name)}

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: 40, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {detail.description !== null && detail.description !== '' && (
          <Text variant="body2" color={colors.text.body}>
            {detail.description}
          </Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text variant="caption" color={colors.text.muted} style={{ flex: 1 }}>
            {t('albums.photoCount', { count: detail.itemCount })}
          </Text>

          <Button
            label={t('albums.addPhotos')}
            variant="secondary"
            size="small"
            loading={addPhotos.isPending}
            onPress={() => void pick()}
            renderIcon={({ size, color }) => (
              <ImagePlus size={size} color={color} strokeWidth={2.1} />
            )}
          />
        </View>

        {permissionDenied && (
          <Text variant="caption" color={colors.themes.destructive.text} accessibilityRole="alert">
            {t('moment.permissionDenied')}
          </Text>
        )}

        {busyKey !== null && (
          <Text variant="caption" color={colors.themes.destructive.text} accessibilityRole="alert">
            {t(busyKey)}
          </Text>
        )}

        {detail.items.length === 0 ? (
          <EmptyState
            renderIcon={(props) => <ImagePlus {...props} strokeWidth={2} />}
            title={t('albums.emptyTitle')}
            description={t('albums.emptyBody')}
          />
        ) : (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              rowGap: 8,
            }}
          >
            {detail.items.map((item) => (
              <Pressable
                key={item.mediaId}
                onPress={() => setActing(item)}
                accessibilityRole="imagebutton"
                accessibilityLabel={t('albums.item.open')}
                style={{ width: CELL }}
              >
                <Image
                  source={mediaSource(item.mediaId)}
                  recyclingKey={item.mediaId}
                  contentFit="cover"
                  transition={140}
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    borderRadius: radius.md,
                    backgroundColor: colors.background.subtle,
                  }}
                />

                {item.mediaId === detail.coverMediaId && (
                  <View
                    style={{
                      position: 'absolute',
                      left: 6,
                      top: 6,
                      width: 20,
                      height: 20,
                      borderRadius: radius.full,
                      backgroundColor: 'rgba(24,24,27,0.62)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    pointerEvents="none"
                  >
                    <Star
                      size={11}
                      color={colors.text.white}
                      strokeWidth={2.4}
                      fill={colors.text.white}
                    />
                  </View>
                )}
              </Pressable>
            ))}

            {/* Keeps a short last row left-aligned; `space-between` would
                otherwise push a lone photograph to the right edge. */}
            {Array.from({ length: fillers }, (_, i) => (
              <View key={`filler-${i}`} style={{ width: CELL }} />
            ))}
          </View>
        )}
      </ScrollView>

      <ItemActions
        item={acting}
        isCover={acting?.mediaId === detail.coverMediaId}
        onClose={() => setActing(null)}
        onSetCover={() => {
          if (acting === null) return;
          update.mutate({ coverMediaId: acting.mediaId }, { onSettled: () => setActing(null) });
        }}
        onRemove={() => {
          if (acting === null) return;
          removeItem.mutate(acting.mediaId, { onSettled: () => setActing(null) });
        }}
      />

      <AlbumFormSheet
        visible={editing}
        mode="edit"
        initial={{ name: detail.name, description: detail.description }}
        saving={update.isPending || deleteAlbum.isPending}
        error={update.error}
        onClose={() => {
          setEditing(false);
          update.reset();
        }}
        onSubmit={(values) =>
          update.mutate(
            { name: values.name, description: values.description ?? '' },
            { onSuccess: () => setEditing(false) },
          )
        }
        onDelete={() =>
          deleteAlbum.mutate(detail.id, {
            onSuccess: () => {
              setEditing(false);
              router.back();
            },
          })
        }
      />
    </View>
  );
}

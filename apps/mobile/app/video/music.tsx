import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Check, Music2, Pause, Play, Upload } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';

import { Pill } from '../../src/components/ai/pill';
import { SelectRow } from '../../src/components/ai/select-row';
import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Card } from '../../src/components/ui/card';
import { IconBadge } from '../../src/components/ui/icon-badge';
import { Text } from '../../src/components/ui/text';
import { useVideoDraft } from '../../src/features/video/draft';
import { useVideoMusic } from '../../src/features/video/use-video';
import { media, video } from '../../src/lib/api';
import { colors, radius, spacing } from '../../src/theme';

/**
 * Màn 29 (11n) — "Songs grouped by mood, or your own".
 * Nghe thử = <audio> web (endpoint public, nhạc built-in); "Use your own song"
 * upload từ máy → musicId 'media:<id>' (server tự resolve khi render).
 * "The music fades under the voices in your clips" = sidechain ducking bên server.
 */
export default function VideoMusicScreen() {
  const { t, i18n } = useTranslation();
  const isJapanese = (i18n.language || '').toLowerCase().startsWith('ja');
  const router = useRouter();
  const { draft, update } = useVideoDraft();
  const catalog = useVideoMusic();

  const themes = useMemo(() => catalog.data?.themes ?? [], [catalog.data]);
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const current = themes.find((th) => th.id === activeTheme) ?? themes[0] ?? null;

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Nghe thử chỉ trên web: track thư viện là endpoint public, <audio> phát thẳng.
  const audioRef = useRef<{ pause: () => void } | null>(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  const togglePlay = (trackId: string) => {
    if (Platform.OS !== 'web') return;
    audioRef.current?.pause();
    if (playingId === trackId) {
      setPlayingId(null);
      return;
    }
    // eslint-disable-next-line no-undef
    const el = new Audio(video.musicFileUrl(trackId));
    el.onended = () => setPlayingId(null);
    void el.play();
    audioRef.current = el;
    setPlayingId(trackId);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  const pick = (trackId: string, title: string, durationS: number) =>
    update({
      musicId: trackId,
      musicLabel: title,
      musicMeta: current ? `${current.name} · ${fmt(durationS)}` : fmt(durationS),
    });

  /** "Use your own song — From your phone" */
  const useOwnSong = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*' });
    const asset = result.assets?.[0];
    if (!asset) return;
    setUploading(true);
    try {
      const up = await media.upload({
        uri: asset.uri,
        name: asset.name ?? 'song.mp3',
        type: asset.mimeType ?? 'audio/mpeg',
      });
      update({
        musicId: `media:${up.id}`,
        musicLabel: asset.name ?? t('video.ownSong'),
        musicMeta: t('video.ownSongMeta'),
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={<ScreenTitle title={t('video.musicTitle')} />}
        right={
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
            <Text variant="body2" weight="semibold" color={colors.coral.hover}>
              {t('common.done')}
            </Text>
          </Pressable>
        }
        paddingRight={spacing.xl}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: 14,
          paddingBottom: 40,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {catalog.isPending && <ActivityIndicator color={colors.coral.primary} />}

        {/* mood chips — thư viện nhạc mang cả tên tiếng Nhật, dùng đúng theo ngôn ngữ đang xem */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {themes.map((th) => (
            <Pill
              key={th.id}
              label={isJapanese && th.name_ja ? th.name_ja : th.name}
              selected={th.id === current?.id}
              onPress={() => setActiveTheme(th.id)}
            />
          ))}
        </ScrollView>

        {/* track rows — MỘT card, play tròn coral + radio phải (11n) */}
        {current && (
          <Card padding={8} style={{ gap: 0 }}>
            {current.tracks.map((tr, index) => {
              const selected = draft.musicId === tr.id;
              return (
                <View
                  key={tr.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    padding: 8,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.state.borderDefault,
                    borderRadius: selected ? radius.xl : 0,
                    backgroundColor: selected ? colors.coral.soft : 'transparent',
                  }}
                >
                  {Platform.OS === 'web' ? (
                    <Pressable
                      onPress={() => togglePlay(tr.id)}
                      accessibilityRole="button"
                      accessibilityLabel={t('video.preview')}
                      style={({ pressed }) => ({
                        width: 34,
                        height: 34,
                        borderRadius: radius.full,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: pressed ? colors.coral.dark : colors.coral.primary,
                      })}
                    >
                      {playingId === tr.id ? (
                        <Pause
                          size={14}
                          color={colors.text.white}
                          strokeWidth={2.4}
                          fill={colors.text.white}
                        />
                      ) : (
                        <Play
                          size={14}
                          color={colors.text.white}
                          strokeWidth={2.4}
                          fill={colors.text.white}
                        />
                      )}
                    </Pressable>
                  ) : (
                    <IconBadge
                      size={34}
                      background={colors.coral.primary}
                      foreground={colors.text.white}
                      renderIcon={({ size, color }) => (
                        <Music2 size={size} color={color} strokeWidth={2.2} />
                      )}
                    />
                  )}

                  <Pressable
                    onPress={() => pick(tr.id, tr.title, tr.duration_s)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="body2" weight="semibold" numberOfLines={1}>
                        {tr.title}
                      </Text>
                      <Text variant="badge" color={colors.text.subtle}>
                        {fmt(tr.duration_s)}
                        {tr.bpm ? ` · ${Math.round(tr.bpm)} BPM` : ''}
                      </Text>
                    </View>
                    {/* radio: vòng rỗng → vòng coral có check */}
                    {selected ? (
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: radius.full,
                          backgroundColor: colors.coral.primary,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={13} color={colors.text.white} strokeWidth={3} />
                      </View>
                    ) : (
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: radius.full,
                          borderWidth: 1.5,
                          borderColor: colors.state.borderNeutral,
                        }}
                      />
                    )}
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}

        {/* Không nhạc — core phải chạy được khi không chọn gì */}
        <SelectRow
          leading={
            <IconBadge
              size={38}
              background={colors.background.subtle}
              foreground={colors.text.muted}
              renderIcon={({ size, color }) => (
                <Music2 size={size} color={color} strokeWidth={2.1} />
              )}
            />
          }
          title={t('video.noMusic')}
          trailing={
            draft.musicId === 'none' ? (
              <Check size={17} color={colors.coral.hover} strokeWidth={2.4} />
            ) : (
              'none'
            )
          }
          onPress={() => update({ musicId: 'none', musicLabel: '', musicMeta: '' })}
        />

        {/* "Use your own song — From your phone" */}
        <SelectRow
          leading={
            uploading ? (
              <View
                style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
              >
                <ActivityIndicator size="small" color={colors.coral.primary} />
              </View>
            ) : (
              <IconBadge
                size={38}
                background={colors.background.subtle}
                foreground={colors.text.secondary}
                renderIcon={({ size, color }) => (
                  <Upload size={size} color={color} strokeWidth={2.1} />
                )}
              />
            )
          }
          title={draft.musicId.startsWith('media:') ? draft.musicLabel : t('video.ownSong')}
          subtitle={
            draft.musicId.startsWith('media:') ? t('video.ownSongPicked') : t('video.ownSongSub')
          }
          trailing={
            draft.musicId.startsWith('media:') ? (
              <Check size={17} color={colors.coral.hover} strokeWidth={2.4} />
            ) : (
              'chevron'
            )
          }
          onPress={() => void useOwnSong()}
        />

        {/* "The music fades under the voices in your clips." */}
        <Text variant="badge" color={colors.text.subtle} style={{ textAlign: 'center' }}>
          {t('video.duckingNote')}
        </Text>
      </ScrollView>
    </View>
  );
}

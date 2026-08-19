import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Clapperboard, Download, Pencil, Play, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

import { SelectRow } from '../../src/components/ai/select-row';
import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton } from '../../src/components/layout/header-slots';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Text } from '../../src/components/ui/text';
import { useMyVideos, useShareVideo, useVideoJob } from '../../src/features/video/use-video';
import { apiAccessToken, video } from '../../src/lib/api';
import { downloadAuthenticated, objectUrlFor } from '../../src/lib/download';
import { colors, radius, spacing } from '../../src/theme';

/**
 * Màn 32 (11k) "Progress you can walk away from" + màn 33 (11l) "Watch, save, share".
 * PROCESSING → progress + checklist giai đoạn (poll 2s); DONE → player + Save/Edit/Share
 * + "Your videos". Job bền trong DB nên rời màn rồi quay lại vẫn đúng trạng thái.
 */

const GREEN = '#4B9E74';

type StageState = 'done' | 'now' | 'todo';

/**
 * Checklist 11k theo THỨ TỰ TRÌNH CHIẾU (Opening → Scenes → Closing card → Music),
 * suy từ stage thật của worker ('opening'/'closing_prep'/'scene:i/n'/'music').
 */
function buildChecklist(
  stage: string | null,
  progress: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): { label: string; state: StageState }[] {
  const m = /^scene:(\d+)\/(\d+)$/.exec(stage ?? '');
  const i = m ? Number(m[1]) : 0;
  const n = m ? Number(m[2]) : 0;
  const inScenes = m !== null;
  const inMusic = stage === 'music' || progress >= 85;

  const rows: { label: string; state: StageState }[] = [];
  rows.push({ label: t('video.stageOpening'), state: inScenes || inMusic ? 'done' : 'now' });

  if (inScenes) {
    if (i > 1)
      rows.push({
        label: i - 1 === 1 ? t('video.sceneN', { n: 1 }) : t('video.stageScenesRange', { from: 1, to: i - 1 }),
        state: 'done',
      });
    rows.push({ label: t('video.stageSceneOf', { i, n }), state: 'now' });
    if (i < n)
      rows.push({
        label: i + 1 === n ? t('video.sceneN', { n }) : t('video.stageScenesRange', { from: i + 1, to: n }),
        state: 'todo',
      });
  } else {
    rows.push({ label: t('video.stageScenes'), state: inMusic ? 'done' : 'todo' });
  }

  rows.push({ label: t('video.stageClosing'), state: inMusic ? 'done' : 'todo' });
  rows.push({ label: t('video.stageMusic'), state: inMusic ? 'now' : 'todo' });
  return rows;
}

export default function VideoJobScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useVideoJob(id ?? null);
  const myVideos = useMyVideos();
  const share = useShareVideo();
  const [savedToDevice, setSavedToDevice] = useState(false);

  const data = job.data;
  const fileUrl = data?.status === 'DONE' ? video.fileUrl(data.id) : null;

  /**
   * Trên web, `<video>` KHÔNG mang được header Authorization, nên nguồn phát
   * phải là blob tải sẵn bằng bearer — không có bước này khung phát chỉ đen
   * (lỗi Sơn gặp 19/08). Native thì gửi header trực tiếp là được.
   */
  const [webUri, setWebUri] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || fileUrl === null) return;
    let cancelled = false;
    let created: string | null = null;
    void objectUrlFor(fileUrl, apiAccessToken()).then((url) => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      created = url;
      setWebUri(url);
    });
    return () => {
      cancelled = true;
      if (created !== null) URL.revokeObjectURL(created);
      setWebUri(null);
    };
  }, [fileUrl]);

  const playerSource =
    fileUrl === null
      ? null
      : Platform.OS === 'web'
        ? webUri === null
          ? null
          : { uri: webUri }
        : { uri: fileUrl, headers: { authorization: `Bearer ${apiAccessToken() ?? ''}` } };

  const player = useVideoPlayer(playerSource);
  // useVideoPlayer chỉ đọc source lúc TẠO player; blob web tới sau nên phải nạp lại.
  useEffect(() => {
    if (playerSource !== null) player.replace(playerSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webUri, fileUrl]);

  const saveToDevice = useMutation({
    mutationFn: async () => {
      if (!fileUrl) return;
      const filename = `${(data?.title || 'memory-video').replace(/[\\/:*?"<>|]/g, '')}.mp4`;
      // Web: tải blob rồi để trình duyệt lưu file (endpoint cần bearer nên
      // <a href> trần sẽ 401).
      if (Platform.OS === 'web') {
        await downloadAuthenticated(fileUrl, filename, apiAccessToken());
        return;
      }
      // Native: import ĐỘNG — expo-media-library không có module web, import
      // tĩnh ở đầu file làm sập cả bundle web ngay khi mở app (đã dính).
      const [MediaLibrary, FileSystem] = await Promise.all([
        import('expo-media-library'),
        import('expo-file-system/legacy'),
      ]);
      const { granted } = await MediaLibrary.requestPermissionsAsync();
      if (!granted) throw new Error('permission');
      const target = `${FileSystem.cacheDirectory}nha-video-${data!.id}.mp4`;
      const dl = await FileSystem.downloadAsync(fileUrl, target, {
        headers: { authorization: `Bearer ${apiAccessToken() ?? ''}` },
      });
      await MediaLibrary.saveToLibraryAsync(dl.uri);
    },
    onSuccess: () => setSavedToDevice(true),
  });

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {data?.status === 'DONE' ? t('video.title') : t('video.makingTitle')}
          </Text>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: 14, paddingBottom: 40, gap: 13 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- màn 32 (11k): đang render ---------- */}
        {data && (data.status === 'PENDING' || data.status === 'PROCESSING') && (
          <>
            <Card padding={15} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Clapperboard size={16} color={colors.coral.hover} strokeWidth={2.1} />
                <Text variant="body1" weight="bold" style={{ flex: 1 }}>
                  {t('video.almostThere')}
                </Text>
                <Text variant="body1" weight="bold">
                  {data.progress}%
                </Text>
              </View>

              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.background.subtle, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${Math.max(3, data.progress)}%`,
                    height: '100%',
                    borderRadius: 4,
                    backgroundColor: colors.coral.primary,
                  }}
                />
              </View>

              <Text variant="caption" color={colors.text.body}>
                {t('video.canLeave')}
              </Text>
            </Card>

            {/* checklist ✓ xanh / ● coral / ○ xám (11k) */}
            <View style={{ gap: 13, paddingHorizontal: 4, paddingTop: 4 }}>
              {buildChecklist(data.stage, data.progress, t).map((row, k) => (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  {row.state === 'done' ? (
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: GREEN,
                      }}
                    >
                      <Check size={12} color={colors.text.white} strokeWidth={3.2} />
                    </View>
                  ) : row.state === 'now' ? (
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.coral.light,
                      }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral.brand }} />
                    </View>
                  ) : (
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.background.subtle,
                      }}
                    >
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.state.borderDashed }} />
                    </View>
                  )}
                  <Text
                    variant="body2"
                    weight={row.state === 'now' ? 'semibold' : 'regular'}
                    color={row.state === 'todo' ? colors.text.lightMuted : colors.text.primary}
                  >
                    {row.label}
                  </Text>
                </View>
              ))}
            </View>

            <Text variant="badge" color={colors.text.subtle} style={{ textAlign: 'center', paddingTop: 8 }}>
              {t('ai.privacyFooter')}
            </Text>
          </>
        )}

        {/* ---------- FAILED ---------- */}
        {data?.status === 'FAILED' && (
          <Card padding={16} style={{ gap: 10 }}>
            <Text variant="body1" weight="semibold">
              {t('video.failed')}
            </Text>
            <Text variant="caption" color={colors.text.body}>
              {data.error}
            </Text>
            <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
          </Card>
        )}

        {/* ---------- màn 33 (11l): xong ---------- */}
        {data?.status === 'DONE' && (
          <>
            <View style={{ borderRadius: radius['2xl'], overflow: 'hidden', backgroundColor: '#000' }}>
              <VideoView
                player={player}
                style={{ width: '100%', aspectRatio: data.options?.aspect === 'landscape' ? 16 / 9 : 9 / 16, maxHeight: 440 }}
                contentFit="contain"
                nativeControls
              />
              {/* web: đang tải bytes về blob — nói rõ chứ không để khung đen im lặng */}
              {Platform.OS === 'web' && webUri === null && (
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: 'rgba(0,0,0,0.55)',
                  }}
                >
                  <ActivityIndicator color={colors.text.white} />
                  <Text variant="badge" color={colors.text.white}>
                    {t('video.loadingPlayer')}
                  </Text>
                </View>
              )}
            </View>

            <View style={{ gap: 2 }}>
              <Text serif weight="bold" style={{ fontSize: 20, lineHeight: 26, letterSpacing: -0.3 }}>
                {data.title || t('video.untitled')}
              </Text>
              <Text variant="caption" color={colors.text.muted}>
                {t('video.doneMeta', {
                  scenes: data.plan?.scenes.length ?? 0,
                  duration: fmtDur(data.duration_s ?? 0),
                })}
              </Text>
            </View>

            {/* Save to photos (coral) + Edit (trắng) trên MỘT hàng (11l).
                Trên web nút này tải file về máy — vẫn phải có, đúng thiết kế. */}
            <View style={{ flexDirection: 'row', gap: 9 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={
                    savedToDevice
                      ? Platform.OS === 'web'
                        ? t('video.downloaded')
                        : t('video.savedToPhotos')
                      : Platform.OS === 'web'
                        ? t('video.download')
                        : t('video.saveToPhotos')
                  }
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={saveToDevice.isPending}
                  disabled={saveToDevice.isPending || savedToDevice}
                  onPress={() => saveToDevice.mutate()}
                  renderIcon={({ size, color }) =>
                    savedToDevice ? (
                      <Check size={size} color={color} strokeWidth={2.6} />
                    ) : (
                      <Download size={size} color={color} strokeWidth={2.1} />
                    )
                  }
                />
              </View>
              <Button
                label={t('video.edit')}
                variant="neutral"
                size="large"
                onPress={() => router.back()}
                renderIcon={({ size, color }) => <Pencil size={size} color={color} strokeWidth={2.1} />}
              />
            </View>
            {saveToDevice.isError && (
              <Text variant="badge" color={colors.themes.destructive.text} style={{ textAlign: 'center' }}>
                {t('video.saveFailed')}
              </Text>
            )}

            {/* "Share with the family — Everyone sees it on the timeline" */}
            <SelectRow
              leading={
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.coral.soft,
                  }}
                >
                  {share.isSuccess ? (
                    <Check size={17} color={colors.coral.hover} strokeWidth={2.4} />
                  ) : (
                    <Users size={17} color={colors.coral.hover} strokeWidth={2.1} />
                  )}
                </View>
              }
              title={share.isSuccess ? t('video.sharedToFamily') : t('video.shareToFamily')}
              subtitle={t('video.shareHint')}
              trailing={share.isSuccess ? 'none' : share.isPending ? 'none' : 'chevron'}
              onPress={share.isSuccess || share.isPending ? undefined : () => share.mutate({ jobId: data.id })}
            />

            {/* "Your videos" — thumbnail ngang (11l) */}
            {(myVideos.data?.length ?? 0) > 1 && (
              <View style={{ gap: 9, paddingTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Clapperboard size={15} color={colors.coral.hover} strokeWidth={2.1} />
                  <Text variant="body2" weight="bold" style={{ flex: 1 }}>
                    {t('video.yourVideos')}
                  </Text>
                  <Text variant="caption" color={colors.text.muted}>
                    {myVideos.data!.length}
                  </Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {myVideos.data!.slice(0, 8).map((v) => (
                    <Pressable
                      key={v.id}
                      onPress={() => v.id !== data.id && router.push({ pathname: '/video/[id]', params: { id: v.id } })}
                      accessibilityRole="button"
                      style={{ width: 148, gap: 5 }}
                    >
                      <View
                        style={{
                          height: 92,
                          borderRadius: radius.xl,
                          backgroundColor: '#141416',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {v.status === 'DONE' ? (
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(255,255,255,0.22)',
                            }}
                          >
                            <Play size={15} color={colors.text.white} strokeWidth={2.2} fill={colors.text.white} />
                          </View>
                        ) : (
                          <Text variant="body2" weight="bold" color={colors.text.white}>
                            {v.status === 'FAILED' ? t('video.failedShort') : `${v.progress}%`}
                          </Text>
                        )}
                      </View>
                      <Text variant="caption" weight="semibold" numberOfLines={1}>
                        {v.title || t('video.untitled')}
                      </Text>
                      <Text variant="badge" color={colors.text.subtle}>
                        {v.created_at.slice(0, 10)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

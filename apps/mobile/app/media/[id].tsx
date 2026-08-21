import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Volume2, VolumeX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';

import { Text } from '../../src/components/ui/text';
import { apiAccessToken, media } from '../../src/lib/api';
import { objectUrlFor } from '../../src/lib/download';
import { mediaSource } from '../../src/lib/media-source';
import { colors, radius, spacing } from '../../src/theme';

/**
 * Xem một ảnh hoặc một đoạn phim của gia đình, chiếm cả màn hình.
 *
 * Vì sao là một màn riêng: chạm vào ảnh trong bài đăng trước đây không dẫn đến
 * đâu cả — người dùng chỉ thấy được bản thu nhỏ trong thẻ. Ở đây ảnh được vẽ
 * trọn khung (`contain`, không cắt) và phim thì phát được ngay.
 *
 * `mime` truyền qua tham số vì màn gọi đã biết nó rồi; thiếu thì coi là ảnh —
 * đoán sai chỉ làm khung đứng im, không làm hỏng gì.
 */
export default function MediaViewerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id, mime } = useLocalSearchParams<{ id: string; mime?: string }>();
  const isVideo = (mime ?? '').startsWith('video');
  const fileUrl = media.streamUrl(id);

  /**
   * Web: `<video>` không mang được header Authorization, nên tải bytes về rồi
   * đưa cho thẻ phát một blob — cùng cách màn phim kỷ niệm đang dùng.
   */
  const [webUri, setWebUri] = useState<string | null>(null);
  useEffect(() => {
    if (!isVideo || Platform.OS !== 'web') return;
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
  }, [fileUrl, isVideo]);

  const playerSource = !isVideo
    ? null
    : Platform.OS === 'web'
      ? webUri === null
        ? null
        : { uri: webUri }
      : { uri: fileUrl, headers: { authorization: `Bearer ${apiAccessToken() ?? ''}` } };

  /**
   * Xem một clip của gia đình thì NGHE được — người ta mở nó ra chính vì tiếng
   * cười và câu nói trong đó. Nút loa vẫn có, cho lúc đang ở nơi công cộng.
   * (Việc hạ tiếng clip xuống 20% là chuyện của phim kỷ niệm, nơi nó phải nằm
   * dưới nhạc — không phải ở đây.)
   */
  const [muted, setMuted] = useState(false);
  const player = useVideoPlayer(playerSource, (p) => {
    p.loop = false;
  });
  useEffect(() => {
    player.muted = muted;
  }, [player, muted]);
  // useVideoPlayer chỉ đọc source lúc tạo; blob của web tới sau nên phải nạp lại.
  useEffect(() => {
    if (playerSource !== null) player.replace(playerSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webUri]);

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0B0C' }}>
      {isVideo ? (
        <VideoView
          player={player}
          style={{ flex: 1 }}
          contentFit="contain"
          nativeControls
          // expo-video trên web tự gắn controlsList="nofullscreen" nếu không
          // bật tường minh — nút toàn màn hình sẽ mất (đã dính ở màn phim).
          fullscreenOptions={{ enable: true }}
        />
      ) : (
        <Image
          source={mediaSource(id)}
          style={{ flex: 1 }}
          contentFit="contain"
          transition={160}
          accessibilityLabel={t('post.openPhoto')}
        />
      )}

      {/* Các nút nổi trên ảnh: màn này không có thanh tiêu đề, vì một tấm ảnh
          nên được xem trọn khung chứ không bị viền khung app cắt bớt. */}
      <View
        style={{
          position: 'absolute',
          top: spacing.xl,
          right: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {isVideo && (
          <Pressable
            onPress={() => setMuted((on) => !on)}
            accessibilityRole="button"
            accessibilityState={{ selected: !muted }}
            accessibilityLabel={muted ? t('media.unmute') : t('media.mute')}
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.full,
              backgroundColor: 'rgba(0,0,0,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {muted ? (
              <VolumeX size={20} color={colors.text.white} strokeWidth={2} />
            ) : (
              <Volume2 size={20} color={colors.text.white} strokeWidth={2} />
            )}
          </Pressable>
        )}

        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: radius.full,
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <Text variant="body2" weight="semibold" color={colors.text.white}>
            {t('common.close')}
          </Text>
        </Pressable>
      </View>

      {/* Nói ra trạng thái, vì một clip im lặng dễ bị hiểu là clip không có tiếng */}
      {isVideo && muted && (
        <Pressable
          onPress={() => setMuted(false)}
          accessibilityRole="button"
          accessibilityLabel={t('media.unmute')}
          style={{
            position: 'absolute',
            left: spacing.lg,
            top: spacing.xl,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: radius.full,
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <VolumeX size={15} color={colors.text.white} strokeWidth={2} />
          <Text variant="caption" weight="medium" color={colors.text.white}>
            {t('media.mutedHint')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

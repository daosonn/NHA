import { Check, Clapperboard } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors } from '../../theme';
import { Card } from '../ui/card';
import { Text } from '../ui/text';
import { NewsCarousel } from './news-carousel';

const GREEN = '#4B9E74';

type StageState = 'done' | 'now' | 'todo';

/** `stage` server đặt cho job đang đợi tới lượt (`video.service.ts`). */
export const STAGE_QUEUED = 'queued';

/**
 * Checklist 11k theo THỨ TỰ TRÌNH CHIẾU (Opening → Scenes → Closing card → Music),
 * suy từ stage thật của worker ('opening'/'closing_prep'/'scene:i/n'/'music').
 */
export function buildChecklist(
  stage: string | null,
  progress: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
): { label: string; state: StageState }[] {
  // Đang đợi tới lượt thì CHƯA có bước nào đang chạy — để "Opening" sáng lên là
  // nói sai với người đang đọc nó.
  if (stage === STAGE_QUEUED) {
    return [
      { label: t('video.stageOpening'), state: 'todo' },
      { label: t('video.stageScenes'), state: 'todo' },
      { label: t('video.stageClosing'), state: 'todo' },
      { label: t('video.stageMusic'), state: 'todo' },
    ];
  }

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
        label:
          i - 1 === 1
            ? t('video.sceneN', { n: 1 })
            : t('video.stageScenesRange', { from: 1, to: i - 1 }),
        state: 'done',
      });
    rows.push({ label: t('video.stageSceneOf', { i, n }), state: 'now' });
    if (i < n)
      rows.push({
        label:
          i + 1 === n
            ? t('video.sceneN', { n })
            : t('video.stageScenesRange', { from: i + 1, to: n }),
        state: 'todo',
      });
  } else {
    rows.push({ label: t('video.stageScenes'), state: inMusic ? 'done' : 'todo' });
  }

  rows.push({ label: t('video.stageClosing'), state: inMusic ? 'done' : 'todo' });
  rows.push({ label: t('video.stageMusic'), state: inMusic ? 'now' : 'todo' });
  return rows;
}

const DOT = 16;

function StageDot({ state }: { state: StageState }) {
  const bg =
    state === 'done' ? GREEN : state === 'now' ? colors.coral.light : colors.background.subtle;
  return (
    <View
      style={{
        width: DOT,
        height: DOT,
        borderRadius: DOT / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
      }}
    >
      {state === 'done' ? (
        <Check size={10} color={colors.text.white} strokeWidth={3.2} />
      ) : state === 'now' ? (
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.coral.brand }} />
      ) : (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.state.borderDashed }} />
      )}
    </View>
  );
}

export type RenderProgressProps = {
  stage: string | null;
  progress: number;
  /**
   * Máy chỉ dựng 2 video một lúc, cái thứ ba đứng đợi tới lượt. Phải nói ra:
   * một thanh 0% không nhích là thứ người ta đọc thành "hỏng rồi".
   */
  queued: boolean;
};

/**
 * Màn 32 (11k) "Progress you can walk away from" — phần thân khi job đang
 * PENDING/PROCESSING.
 *
 * Checklist giai đoạn nằm TRONG card tiến độ (hairline ngăn, dòng 16px) thay
 * vì thả rời phía dưới: người dùng vẫn thấy シーン1, 2/10… nhưng khối ngắn
 * lại ~40%, để phía dưới còn chỗ cho dải NEWS của Alpha Club trong lúc chờ.
 *
 * Trả về fragment để các phần tử ăn `gap` của ScrollView cha.
 */
export function RenderProgress({ stage, progress, queued }: RenderProgressProps) {
  const { t } = useTranslation();

  return (
    <>
      <Card padding={15} style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Clapperboard size={16} color={colors.coral.hover} strokeWidth={2.1} />
          <Text variant="body1" weight="bold" style={{ flex: 1 }}>
            {queued ? t('video.queued') : t('video.almostThere')}
          </Text>
          {!queued && (
            <Text variant="body1" weight="bold">
              {progress}%
            </Text>
          )}
        </View>

        <View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.background.subtle,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${Math.max(3, progress)}%`,
              height: '100%',
              borderRadius: 4,
              backgroundColor: colors.coral.primary,
            }}
          />
        </View>

        <Text variant="caption" color={colors.text.body}>
          {queued ? t('video.queuedHint') : t('video.canLeave')}
        </Text>

        {/* checklist ✓ xanh / ● coral / ○ xám (11k) */}
        <View style={{ height: 1, backgroundColor: colors.state.borderDefault, marginTop: 2 }} />
        <View style={{ gap: 8, paddingTop: 2 }}>
          {buildChecklist(stage, progress, t).map((row, k) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <StageDot state={row.state} />
              <Text
                variant="caption"
                weight={row.state === 'now' ? 'semibold' : 'regular'}
                color={row.state === 'todo' ? colors.text.lightMuted : colors.text.primary}
                numberOfLines={1}
                style={{ flex: 1 }}
              >
                {row.label}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Text variant="badge" color={colors.text.subtle} style={{ textAlign: 'center' }}>
        {t('ai.privacyFooter')}
      </Text>

      {/* Quảng cáo / tin tức Alpha Club trong lúc chờ render */}
      <View style={{ paddingTop: 6 }}>
        <NewsCarousel />
      </View>
    </>
  );
}

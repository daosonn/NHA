import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, Minus, PenLine, Plus, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton } from '../../src/components/layout/header-slots';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Chip } from '../../src/components/ui/chip';
import { Text } from '../../src/components/ui/text';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useVideoDraft } from '../../src/features/video/draft';
import { useCreateAndRender } from '../../src/features/video/use-video';
import { mediaSource } from '../../src/lib/media-source';
import { colors, radius, spacing } from '../../src/theme';
import { useTypeface } from '../../src/theme/typeface';

/**
 * Màn 31 (11j) — "Story on top, then the scenes — reorder, retime, rewrite as much
 * as you like." Mọi chỉnh sửa là local (0 token); "Make the video" mới tạo job + render.
 */

/** Giới hạn ký tự khớp server DTO (PlanDto) — counter hiện n/max như mockup. */
const LIMITS = { title: 40, subtitle: 52, closing: 160, opening: 160, dedication: 60 } as const;

export default function VideoStoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { familyId } = useActiveFamily();
  const { draft, update } = useVideoDraft();
  const createAndRender = useCreateAndRender(familyId);
  const typeface = useTypeface('medium');

  const plan = draft.plan;
  if (!plan) {
    return (
      <View className="flex-1 bg-page" style={{ alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <Text variant="body2" color={colors.text.body}>
          {t('video.noPlan')}
        </Text>
        <Button label={t('common.back')} variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const patchPlan = (patch: Partial<typeof plan>) => update({ plan: { ...plan, ...patch } });
  const patchScene = (i: number, patch: Partial<(typeof plan.scenes)[number]>) =>
    patchPlan({ scenes: plan.scenes.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const moveScene = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= plan.scenes.length) return;
    const scenes = [...plan.scenes];
    [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
    patchPlan({ scenes });
  };
  const removeScene = (i: number) => patchPlan({ scenes: plan.scenes.filter((_, k) => k !== i) });

  const totalSec = Math.round(plan.scenes.reduce((a, s) => a + s.durationS, 0));
  const isClip = (mediaId: string) => draft.mediaKinds[mediaId] === 'video';

  const make = () =>
    createAndRender.mutate(
      {
        memberId: draft.memberId ?? undefined,
        mediaIds: plan.scenes.map((s) => s.mediaId),
        mode: 'ai',
        plan,
        targetSec: draft.targetSec,
        mood: draft.mood,
        aspect: draft.aspect,
        style: draft.style,
        musicId: draft.musicId,
      },
      { onSuccess: (job) => router.push({ pathname: '/video/[id]', params: { id: job.id } }) },
    );

  /** Một dòng trường sửa được: NHÃN HOA nhỏ + giá trị + đếm ký tự + bút (11j). */
  const fieldRow = (labelKey: string, value: string, max: number, onChange: (v: string) => void, last = false) => (
    <View style={{ gap: 3, paddingVertical: 9, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.state.borderDefault }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="badge" weight="semibold" color={colors.text.lightMuted} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
          {t(labelKey)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="badge" color={colors.text.subtle}>
            {value.length}/{max}
          </Text>
          <PenLine size={12} color={colors.text.lightMuted} strokeWidth={2.1} />
        </View>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        maxLength={max}
        multiline
        placeholder={t('video.captionPlaceholder')}
        placeholderTextColor={colors.text.subtle}
        style={{ padding: 0, ...typeface, fontSize: 15, lineHeight: 22, color: colors.text.primary }}
      />
    </View>
  );

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {t('video.storyScenesTitle')}
          </Text>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: 14, paddingBottom: 40, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* tóm tắt câu chuyện + "8 scenes · ~92 seconds" + phong cách mở đầu */}
        {!!draft.storyRequest && (
          <Text variant="caption" color={colors.text.body}>
            {draft.storyRequest}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <Text variant="body1" weight="bold">
            {t('video.sceneSummary', { count: plan.scenes.length, seconds: totalSec })}
          </Text>
          <Text variant="caption" color={colors.text.muted}>
            {t(`video.styleOpening.${draft.style}`)}
          </Text>
        </View>

        {/* TITLE / SUBTITLE / CLOSING LINE / OPENING WORDS / DEDICATION — một card (11j) */}
        <Card padding={13} style={{ gap: 0 }}>
          {fieldRow('video.fieldTitle', plan.title, LIMITS.title, (v) => patchPlan({ title: v }))}
          {fieldRow('video.fieldSubtitle', plan.subtitle ?? '', LIMITS.subtitle, (v) => patchPlan({ subtitle: v }))}
          {fieldRow('video.fieldClosing', plan.closing ?? '', LIMITS.closing, (v) => patchPlan({ closing: v }))}
          {fieldRow('video.fieldOpening', plan.opening ?? '', LIMITS.opening, (v) => patchPlan({ opening: v }))}
          {fieldRow('video.fieldDedication', plan.dedication ?? '', LIMITS.dedication, (v) => patchPlan({ dedication: v }), true)}
        </Card>

        {/* "Eight scenes — tap any line to rewrite" */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <Text variant="body1" weight="bold">
            {t('video.scenesHeading', { count: plan.scenes.length })}
          </Text>
          <Text variant="badge" color={colors.text.muted}>
            {t('video.rewriteHint')}
          </Text>
        </View>
        <Text variant="badge" color={colors.text.subtle}>
          {t('video.scenesHint')}
        </Text>

        {plan.scenes.map((s, i) => (
          <Card key={`${s.mediaId}_${i}`} padding={12} style={{ gap: 9 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Image
                source={mediaSource(s.mediaId)}
                style={{ width: 62, height: 62, borderRadius: radius.lg, backgroundColor: colors.background.subtle }}
                contentFit="cover"
              />
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text variant="body2" weight="bold">
                    {t('video.sceneN', { n: i + 1 })}
                  </Text>
                  <Chip label={isClip(s.mediaId) ? t('video.clipBadge') : t('video.photoBadge')} />
                </View>
                {/* caption trong khung, có bút — "tap any line to rewrite" */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.state.borderNeutral,
                    backgroundColor: colors.background.surfaceSoft,
                  }}
                >
                  <TextInput
                    value={s.caption}
                    onChangeText={(v) => patchScene(i, { caption: v })}
                    placeholder={t('video.captionPlaceholder')}
                    placeholderTextColor={colors.text.subtle}
                    maxLength={80}
                    style={{ flex: 1, padding: 0, ...typeface, fontSize: 13.5, lineHeight: 19, color: colors.text.primary }}
                  />
                  <PenLine size={13} color={colors.text.lightMuted} strokeWidth={2.1} />
                </View>
              </View>
            </View>

            {/* ↑ ↓ ✕ + stepper "− 5s +" */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {(
                [
                  { icon: ArrowUp, onPress: () => moveScene(i, -1), disabled: i === 0, label: t('video.moveUp') },
                  { icon: ArrowDown, onPress: () => moveScene(i, 1), disabled: i === plan.scenes.length - 1, label: t('video.moveDown') },
                  { icon: X, onPress: () => removeScene(i), disabled: plan.scenes.length <= 1, label: t('video.removeScene') },
                ] as const
              ).map(({ icon: Icon, onPress, disabled, label }, k) => (
                <Pressable
                  key={k}
                  onPress={onPress}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  style={({ pressed }) => ({
                    width: 30,
                    height: 30,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: disabled ? colors.state.disabledBorder : colors.state.borderNeutral,
                    backgroundColor: pressed ? colors.background.subtle : colors.background.card,
                  })}
                >
                  <Icon size={14} color={disabled ? colors.state.disabledText : colors.text.secondary} strokeWidth={2.2} />
                </Pressable>
              ))}

              <View style={{ flex: 1 }} />

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  height: 30,
                  paddingHorizontal: 10,
                  borderRadius: radius.md,
                  backgroundColor: colors.background.subtle,
                }}
              >
                <Pressable
                  onPress={() => patchScene(i, { durationS: Math.max(3, s.durationS - 1) })}
                  accessibilityRole="button"
                  accessibilityLabel={t('video.shorter')}
                  hitSlop={6}
                >
                  <Minus size={14} color={colors.text.secondary} strokeWidth={2.4} />
                </Pressable>
                <Text variant="caption" weight="bold">
                  {Math.round(s.durationS)}s
                </Text>
                <Pressable
                  onPress={() => patchScene(i, { durationS: Math.min(8, s.durationS + 1) })}
                  accessibilityRole="button"
                  accessibilityLabel={t('video.longer')}
                  hitSlop={6}
                >
                  <Plus size={14} color={colors.text.secondary} strokeWidth={2.4} />
                </Pressable>
              </View>
            </View>

            {/* vì sao cảnh nằm ở đây — reason từ storyboard */}
            {!!s.reason && (
              <Text variant="badge" color={colors.text.muted}>
                {s.reason}
              </Text>
            )}
          </Card>
        ))}

        <Text variant="badge" color={colors.text.subtle} style={{ textAlign: 'center' }}>
          {t('video.reorderHint')}
        </Text>
        <Button
          label={createAndRender.isPending ? t('video.making') : t('video.makeVideo')}
          variant="primary"
          size="large"
          fullWidth
          disabled={createAndRender.isPending || plan.scenes.length === 0}
          onPress={make}
        />
      </ScrollView>
    </View>
  );
}

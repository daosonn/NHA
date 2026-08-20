import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Flower2, PenLine, Share2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { Pill } from '../../src/components/ai/pill';
import { SectionLabel } from '../../src/components/ai/section-label';
import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton } from '../../src/components/layout/header-slots';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useSession } from '../../src/features/auth/session';
import { ai, posts } from '../../src/lib/api';
import type { MessageVariant } from '../../src/lib/api';
import { mediaSource } from '../../src/lib/media-source';
import { colors, radius, spacing } from '../../src/theme';

/**
 * Màn 26 (11g) — "Make a card": chọn độ dài lời nhắn (Short/Standard/Heartfelt),
 * 5 mẫu thiết kế có badge "fits", live preview vẽ bằng View; "Save the card"
 * render PNG server-side (sharp, 0 token); nút share tròn đính PNG lên timeline.
 */

type TemplateId = 'marigold' | 'birthday' | 'tulip' | 'tet' | 'kraft';

/** Màu khớp `apps/api/src/ai/card.service.ts` THEMES — preview phải giống PNG. */
const TEMPLATES: { id: TemplateId; bg: string; frame: string; accent: string; ink: string; sub: string; maxChars: number }[] = [
  { id: 'marigold', bg: '#F7DE8B', frame: '#B98A1F', accent: '#8A6B14', ink: '#4A3B22', sub: '#8A6B14', maxChars: 220 },
  { id: 'birthday', bg: '#F9C89B', frame: '#C2652F', accent: '#A9531F', ink: '#43302C', sub: '#8C4F26', maxChars: 200 },
  { id: 'tulip', bg: '#F6C9DC', frame: '#B7548E', accent: '#8E3E6C', ink: '#5A2C44', sub: '#96477A', maxChars: 160 },
  { id: 'tet', bg: '#A62B22', frame: '#E8B84B', accent: '#F6D77E', ink: '#FFF4DC', sub: '#F0CFA0', maxChars: 120 },
  { id: 'kraft', bg: '#E7DCC8', frame: '#8A744C', accent: '#6B5B3E', ink: '#463A26', sub: '#7C6C50', maxChars: 180 },
];

type VariantParam = { length: MessageVariant['length']; text: string };

const LENGTH_KEY: Record<MessageVariant['length'], string> = {
  short: 'ai.message.short',
  standard: 'ai.message.standard',
  heartfelt: 'ai.message.heartfelt',
};

export default function CardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { familyId } = useActiveFamily();
  const { user } = useSession();
  const params = useLocalSearchParams<{ variants?: string; message?: string; toName?: string; occasion?: string }>();

  // 3 biến thể từ màn 25; fallback 1 message trần khi vào thẳng
  const variants = useMemo<VariantParam[]>(() => {
    try {
      const parsed = JSON.parse(params.variants ?? '[]') as VariantParam[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // ignore — dùng fallback bên dưới
    }
    return params.message ? [{ length: 'standard', text: params.message }] : [];
  }, [params.variants, params.message]);

  const [length, setLength] = useState<MessageVariant['length']>(variants[1]?.length ?? variants[0]?.length ?? 'standard');
  const [template, setTemplate] = useState<TemplateId>('marigold');
  const [message, setMessage] = useState(
    variants.find((v) => v.length === (variants[1]?.length ?? 'standard'))?.text ?? variants[0]?.text ?? '',
  );
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);

  const toName = params.toName ?? '';
  const fromName = user?.name ?? '';

  const pickLength = (l: MessageVariant['length']) => {
    setLength(l);
    const v = variants.find((x) => x.length === l);
    if (v) setMessage(v.text);
    setMediaId(null);
    setSharedPostId(null);
  };

  const render = useMutation({
    mutationFn: () =>
      ai.renderCard(familyId as string, {
        template,
        message: message.trim(),
        toName,
        fromName,
        heading: params.occasion ?? undefined,
      }),
    onSuccess: (r) => setMediaId(r.media_id),
  });

  const share = useMutation({
    mutationFn: () =>
      posts.create({
        type: 'POST',
        content: t('ai.card.shareCaption', { name: toName }),
        familyIds: familyId ? [familyId] : [],
        mediaIds: mediaId ? [mediaId] : [],
      }),
    onSuccess: (p) => setSharedPostId(p.id),
  });

  const active = TEMPLATES.find((x) => x.id === template)!;

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {t('ai.card.title')}
          </Text>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: 14, paddingBottom: 40, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {/* MESSAGE — chọn độ dài (11g) */}
        {variants.length > 1 && (
          <>
            <SectionLabel label={t('ai.card.message')} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {variants.map((v) => (
                <Pill key={v.length} label={t(LENGTH_KEY[v.length])} selected={length === v.length} onPress={() => pickLength(v.length)} />
              ))}
            </View>
            <View style={{ height: 4 }} />
          </>
        )}

        {/* DESIGN — 5 mẫu, badge "fits" khi lời nhắn vừa khuôn */}
        <SectionLabel label={t('ai.card.design')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
          {TEMPLATES.map((tp) => {
            const selected = tp.id === template;
            const fits = message.trim().length > 0 && message.trim().length <= tp.maxChars;
            return (
              <Pressable
                key={tp.id}
                onPress={() => {
                  setTemplate(tp.id);
                  setMediaId(null);
                  setSharedPostId(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{ alignItems: 'center', gap: 5 }}
              >
                <View
                  style={{
                    width: 78,
                    height: 98,
                    borderRadius: radius.xl,
                    backgroundColor: tp.bg,
                    borderWidth: selected ? 2.5 : 1,
                    borderColor: selected ? colors.coral.primary : colors.state.borderNeutral,
                    padding: 10,
                    paddingTop: 16,
                    gap: 5,
                  }}
                >
                  {fits && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 5,
                        left: 5,
                        paddingHorizontal: 6,
                        height: 15,
                        justifyContent: 'center',
                        borderRadius: radius.full,
                        backgroundColor: colors.coral.primary,
                      }}
                    >
                      <Text weight="bold" color={colors.text.white} style={{ fontSize: 8, lineHeight: 10 }}>
                        {t('ai.card.fits')}
                      </Text>
                    </View>
                  )}
                  {/* mấy vạch chữ mô phỏng của mockup */}
                  <View style={{ height: 5, width: '72%', borderRadius: 3, backgroundColor: tp.frame, opacity: 0.9 }} />
                  <View style={{ height: 4, width: '88%', borderRadius: 2, backgroundColor: tp.frame, opacity: 0.45 }} />
                  <View style={{ height: 4, width: '80%', borderRadius: 2, backgroundColor: tp.frame, opacity: 0.45 }} />
                  <View style={{ height: 4, width: '62%', borderRadius: 2, backgroundColor: tp.frame, opacity: 0.45 }} />
                </View>
                <Text variant="badge" weight={selected ? 'bold' : 'medium'} color={selected ? colors.text.primary : colors.text.muted}>
                  {t(`ai.card.template.${tp.id}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Live preview: PNG thật sau khi render, còn lại là preview View có hoa góc */}
        {mediaId ? (
          <Image
            source={mediaSource(mediaId)}
            style={{ width: '100%', aspectRatio: 1080 / 1520, borderRadius: radius.xl }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              aspectRatio: 1080 / 1520,
              borderRadius: radius.xl,
              backgroundColor: active.bg,
              padding: 12,
              boxShadow: '0 10px 26px rgba(24,24,27,0.16)',
            }}
          >
            {/* khung kép — giống PNG server render (46px + 64px) */}
            <View
              style={{
                flex: 1,
                borderRadius: radius.lg,
                borderWidth: 2,
                borderColor: active.frame,
                padding: 6,
              }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: active.frame,
                  opacity: 1,
                  paddingHorizontal: 22,
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                <View style={{ position: 'absolute', top: 10, left: 10 }}>
                  <Flower2 size={20} color={active.frame} strokeWidth={2} />
                </View>
                <View style={{ position: 'absolute', bottom: 10, right: 10 }}>
                  <Flower2 size={20} color={active.frame} strokeWidth={2} />
                </View>

                {!!params.occasion && (
                  <Text
                    weight="bold"
                    color={active.sub}
                    style={{ textAlign: 'center', letterSpacing: 3.6, fontSize: 10, lineHeight: 14 }}
                  >
                    {params.occasion.toUpperCase()}
                  </Text>
                )}

                <Text
                  serif
                  weight="bold"
                  color={active.ink}
                  style={{ textAlign: 'center', fontSize: 23, lineHeight: 29, fontStyle: 'italic' }}
                >
                  {t('ai.card.dear', { name: toName })}
                </Text>

                {/* gạch ngắn + hai chấm dưới tên */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: active.accent }} />
                  <View style={{ width: 74, height: 1.5, backgroundColor: active.frame }} />
                  <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: active.accent }} />
                </View>

                <Text variant="body2" color={active.ink} style={{ textAlign: 'center', lineHeight: 22 }}>
                  {message || t('ai.card.emptyMessage')}
                </Text>

                {/* ký tên: gạch HAI ĐẦU */}
                <Text
                  serif
                  variant="body2"
                  color={active.accent}
                  style={{ textAlign: 'center', fontStyle: 'italic' }}
                >
                  — {fromName} —
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* EDIT */}
        <TextField
          label={t('ai.card.editMessage')}
          uppercaseLabel
          value={message}
          onChangeText={(v) => {
            setMessage(v);
            setMediaId(null);
            setSharedPostId(null);
          }}
          multiline
          renderIcon={({ size, color }) => <PenLine size={size} color={color} strokeWidth={2.1} />}
        />

        {/* Save the card + nút share tròn (11g) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button
              label={mediaId ? t('ai.card.savedCard') : render.isPending ? t('ai.card.rendering') : t('ai.card.save')}
              variant="primary"
              size="large"
              fullWidth
              disabled={!familyId || message.trim().length === 0 || render.isPending || !!mediaId}
              onPress={() => render.mutate()}
            />
          </View>
          <Pressable
            onPress={() => mediaId && !sharedPostId && !share.isPending && share.mutate()}
            accessibilityRole="button"
            accessibilityLabel={t('ai.card.share')}
            disabled={!mediaId || !!sharedPostId || share.isPending}
            style={({ pressed }) => ({
              width: 52,
              height: 52,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: mediaId ? colors.state.borderNeutral : colors.state.disabledBorder,
              backgroundColor: pressed ? colors.background.subtle : colors.background.card,
            })}
          >
            {sharedPostId ? (
              <Check size={20} color={colors.coral.hover} strokeWidth={2.4} />
            ) : (
              <Share2 size={20} color={mediaId ? colors.text.primary : colors.state.disabledText} strokeWidth={2.1} />
            )}
          </Pressable>
        </View>

        {sharedPostId && (
          <Text variant="badge" color={colors.text.subtle} style={{ textAlign: 'center' }}>
            {t('ai.card.shared')}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

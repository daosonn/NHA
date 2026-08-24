import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Download, Flower2, PenLine, Share2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';

import { InlineError } from '../../src/components/ai/inline-error';
import { Pill } from '../../src/components/ai/pill';
import { SectionLabel } from '../../src/components/ai/section-label';
import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useToast } from '../../src/components/ui/toast';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useSession } from '../../src/features/auth/session';
import { ai, apiAccessToken, media, posts } from '../../src/lib/api';
import type { MessageVariant } from '../../src/lib/api';
import { downloadAuthenticated } from '../../src/lib/download';
import { mediaSource } from '../../src/lib/media-source';
import { colors, radius, spacing } from '../../src/theme';

/**
 * Màn 26 (11g) — "Make a card": chọn độ dài lời nhắn (Short/Standard/Heartfelt),
 * 5 mẫu thiết kế có badge "fits", live preview vẽ bằng View; "Save the card"
 * render PNG server-side (sharp, 0 token); nút share tròn đính PNG lên timeline.
 */

type TemplateId = 'marigold' | 'birthday' | 'tulip' | 'tet' | 'kraft';

/** Màu khớp `apps/api/src/ai/card.service.ts` THEMES — preview phải giống PNG. */
const TEMPLATES: {
  id: TemplateId;
  bg: string;
  frame: string;
  accent: string;
  ink: string;
  sub: string;
  maxChars: number;
}[] = [
  {
    id: 'marigold',
    bg: '#F7DE8B',
    frame: '#B98A1F',
    accent: '#8A6B14',
    ink: '#4A3B22',
    sub: '#8A6B14',
    maxChars: 220,
  },
  {
    id: 'birthday',
    bg: '#F9C89B',
    frame: '#C2652F',
    accent: '#A9531F',
    ink: '#43302C',
    sub: '#8C4F26',
    maxChars: 200,
  },
  {
    id: 'tulip',
    bg: '#F6C9DC',
    frame: '#B7548E',
    accent: '#8E3E6C',
    ink: '#5A2C44',
    sub: '#96477A',
    maxChars: 160,
  },
  {
    id: 'tet',
    bg: '#A62B22',
    frame: '#E8B84B',
    accent: '#F6D77E',
    ink: '#FFF4DC',
    sub: '#F0CFA0',
    maxChars: 120,
  },
  {
    id: 'kraft',
    bg: '#E7DCC8',
    frame: '#8A744C',
    accent: '#6B5B3E',
    ink: '#463A26',
    sub: '#7C6C50',
    maxChars: 180,
  },
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
  const toast = useToast();
  const { familyId } = useActiveFamily();
  const { user } = useSession();
  const params = useLocalSearchParams<{
    variants?: string;
    message?: string;
    toName?: string;
    occasion?: string;
  }>();

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

  const [length, setLength] = useState<MessageVariant['length']>(
    variants[1]?.length ?? variants[0]?.length ?? 'standard',
  );
  const [template, setTemplate] = useState<TemplateId>('marigold');
  const [message, setMessage] = useState(
    variants.find((v) => v.length === (variants[1]?.length ?? 'standard'))?.text ??
      variants[0]?.text ??
      '',
  );
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [sharedPostId, setSharedPostId] = useState<string | null>(null);
  const [savedToDevice, setSavedToDevice] = useState(false);
  // PNG tải hỏng ≠ PNG không tồn tại: giữ mediaId (nút chia sẻ/lưu còn sống),
  // chỉ quay hình về preview sống.
  const [imageFailed, setImageFailed] = useState(false);

  // Server DTO giới hạn 40 ký tự cho hai tên (displayName cho phép tới 100) —
  // không cắt thì "Save the card" 400 vĩnh viễn với tên dài. Cắt hiển thị và
  // cắt payload cùng một chỗ để preview và PNG nói cùng một điều.
  const toName = (params.toName ?? '').slice(0, 40).trim();
  const fromName = (user?.name ?? '').slice(0, 40).trim();

  const pickLength = (l: MessageVariant['length']) => {
    setLength(l);
    const v = variants.find((x) => x.length === l);
    if (v) setMessage(v.text);
    discardRender();
  };

  /** Mọi chỉnh sửa (chữ, mẫu, độ dài) làm bản render cũ — và cả lỗi cũ — hết hiệu lực. */
  const discardRender = () => {
    setMediaId(null);
    setSharedPostId(null);
    setImageFailed(false);
    render.reset();
  };

  const render = useMutation({
    mutationFn: () =>
      ai.renderCard(familyId as string, {
        template,
        message: message.trim(),
        toName,
        fromName,
        // DTO cap 80 — dịp tự đặt có thể dài hơn, cắt để không 400
        heading: params.occasion ? params.occasion.slice(0, 80) : undefined,
      }),
    onSuccess: (r) => {
      setMediaId(r.media_id);
      setSavedToDevice(false);
      setImageFailed(false);
    },
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

  // Lưu PNG về máy — cùng pattern với `app/video/[id].tsx` (web: blob + bearer,
  // native: import động expo-media-library vì nó không có module web).
  const saveToDevice = useMutation({
    mutationFn: async () => {
      if (!mediaId) return;
      const url = media.streamUrl(mediaId);
      if (Platform.OS === 'web') {
        await downloadAuthenticated(url, 'nha-card.png', apiAccessToken());
        return;
      }
      const [MediaLibrary, FileSystem] = await Promise.all([
        import('expo-media-library'),
        import('expo-file-system/legacy'),
      ]);
      const { granted } = await MediaLibrary.requestPermissionsAsync();
      if (!granted) throw new Error('permission');
      const target = `${FileSystem.cacheDirectory}nha-card-${mediaId}.png`;
      const dl = await FileSystem.downloadAsync(url, target, {
        headers: { authorization: `Bearer ${apiAccessToken() ?? ''}` },
      });
      await MediaLibrary.saveToLibraryAsync(dl.uri);
    },
    onSuccess: () => setSavedToDevice(true),
    onError: () => toast.failure(t('ai.card.saveFailed')),
  });

  const active = TEMPLATES.find((x) => x.id === template)!;
  // Vượt khuôn mẫu đang chọn bao nhiêu ký tự (>0 là quá dài).
  const overBy = message.trim().length - active.maxChars;

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={<ScreenTitle title={t('ai.card.title')} />}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: 14,
          paddingBottom: 40,
          gap: 10,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* MESSAGE — chọn độ dài (11g) */}
        {variants.length > 1 && (
          <>
            <SectionLabel label={t('ai.card.message')} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {variants.map((v) => (
                <Pill
                  key={v.length}
                  label={t(LENGTH_KEY[v.length])}
                  selected={length === v.length}
                  onPress={() => pickLength(v.length)}
                />
              ))}
            </View>
            <View style={{ height: 4 }} />
          </>
        )}

        {/* DESIGN — 5 mẫu, badge "fits" khi lời nhắn vừa khuôn */}
        <SectionLabel label={t('ai.card.design')} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingVertical: 2 }}
        >
          {TEMPLATES.map((tp) => {
            const selected = tp.id === template;
            const fits = message.trim().length > 0 && message.trim().length <= tp.maxChars;
            const over = message.trim().length - tp.maxChars;
            return (
              <Pressable
                key={tp.id}
                onPress={() => {
                  setTemplate(tp.id);
                  discardRender();
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
                        height: 16,
                        justifyContent: 'center',
                        borderRadius: radius.full,
                        backgroundColor: colors.coral.light,
                      }}
                    >
                      <Text
                        weight="bold"
                        color={colors.coral.deep}
                        style={{ fontSize: 10, lineHeight: 12 }}
                      >
                        {t('ai.card.fits')}
                      </Text>
                    </View>
                  )}
                  {/* quá khuôn mẫu này bao nhiêu ký tự — để so nhanh giữa 5 mẫu */}
                  {over > 0 && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 5,
                        left: 5,
                        paddingHorizontal: 6,
                        height: 16,
                        justifyContent: 'center',
                        borderRadius: radius.full,
                        backgroundColor: colors.background.subtle,
                      }}
                    >
                      <Text
                        weight="semibold"
                        color={colors.text.muted}
                        style={{ fontSize: 10, lineHeight: 12 }}
                      >
                        {`−${over}`}
                      </Text>
                    </View>
                  )}
                  {/* mấy vạch chữ mô phỏng của mockup */}
                  <View
                    style={{
                      height: 5,
                      width: '72%',
                      borderRadius: 3,
                      backgroundColor: tp.frame,
                      opacity: 0.9,
                    }}
                  />
                  <View
                    style={{
                      height: 4,
                      width: '88%',
                      borderRadius: 2,
                      backgroundColor: tp.frame,
                      opacity: 0.45,
                    }}
                  />
                  <View
                    style={{
                      height: 4,
                      width: '80%',
                      borderRadius: 2,
                      backgroundColor: tp.frame,
                      opacity: 0.45,
                    }}
                  />
                  <View
                    style={{
                      height: 4,
                      width: '62%',
                      borderRadius: 2,
                      backgroundColor: tp.frame,
                      opacity: 0.45,
                    }}
                  />
                </View>
                <Text
                  variant="badge"
                  weight={selected ? 'bold' : 'medium'}
                  color={selected ? colors.text.primary : colors.text.muted}
                >
                  {t(`ai.card.template.${tp.id}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Live preview: PNG thật sau khi render, còn lại là preview View có hoa góc */}
        {mediaId && !imageFailed ? (
          <Image
            source={mediaSource(mediaId)}
            style={{ width: '100%', aspectRatio: 1080 / 1520, borderRadius: radius.xl }}
            contentFit="cover"
            transition={150}
            // PNG tải hỏng thì quay về preview sống thay vì ô trống — nhưng PNG
            // vẫn tồn tại trên server, nên trạng thái đã-lưu/chia-sẻ giữ nguyên.
            onError={() => setImageFailed(true)}
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
                    style={{
                      textAlign: 'center',
                      letterSpacing: 3.6,
                      fontSize: 10,
                      lineHeight: 14,
                    }}
                  >
                    {params.occasion.toUpperCase()}
                  </Text>
                )}

                {/* vào bằng deep link thì không có tên — bỏ hẳn dòng "Dear" */}
                {toName !== '' && (
                  <>
                    <Text
                      serif
                      weight="bold"
                      color={active.ink}
                      style={{
                        textAlign: 'center',
                        fontSize: 23,
                        lineHeight: 29,
                        fontStyle: 'italic',
                      }}
                    >
                      {t('ai.card.dear', { name: toName })}
                    </Text>

                    {/* gạch ngắn + hai chấm dưới tên */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 7,
                      }}
                    >
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: active.accent,
                        }}
                      />
                      <View style={{ width: 74, height: 1.5, backgroundColor: active.frame }} />
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: active.accent,
                        }}
                      />
                    </View>
                  </>
                )}

                <Text
                  variant="body2"
                  color={active.ink}
                  style={{ textAlign: 'center', lineHeight: 22 }}
                >
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
            discardRender();
          }}
          multiline
          hint={message.trim().length === 0 ? t('ai.card.emptyHint') : undefined}
          error={overBy > 0 ? t('ai.card.tooLong', { count: overBy }) : undefined}
          renderIcon={({ size, color }) => <PenLine size={size} color={color} strokeWidth={2.1} />}
        />

        {/* Save the card + nút share tròn (11g) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button
              label={
                render.isPending
                  ? t('ai.card.rendering')
                  : mediaId
                    ? t('ai.card.savedCard')
                    : t('ai.card.save')
              }
              variant="primary"
              size="large"
              fullWidth
              loading={render.isPending}
              // vẫn bấm được khi đã lưu — bấm lại là render lại, không phải nút chết
              disabled={!familyId || message.trim().length === 0 || overBy > 0}
              onPress={() => render.mutate()}
              renderIcon={
                mediaId
                  ? ({ size, color }) => <Check size={size} color={color} strokeWidth={2.6} />
                  : undefined
              }
            />
          </View>
          <Pressable
            onPress={() => mediaId && !sharedPostId && !share.isPending && share.mutate()}
            accessibilityRole="button"
            accessibilityLabel={sharedPostId ? t('ai.card.shared') : t('ai.card.share')}
            accessibilityState={{ busy: share.isPending }}
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
              // xanh "đã xong" — coral để dành cho hành động chính
              <Check size={20} color={colors.themes.hobbies.text} strokeWidth={2.4} />
            ) : share.isPending ? (
              <ActivityIndicator
                size="small"
                color={colors.coral.brand}
                style={{ width: 16, height: 16 }}
              />
            ) : (
              <Share2
                size={20}
                color={mediaId ? colors.text.primary : colors.state.disabledText}
                strokeWidth={2.1}
              />
            )}
          </Pressable>
        </View>

        {/* render hỏng: nói ra + cho bấm thử lại ngay tại chỗ */}
        {render.isError && (
          <InlineError message={t('ai.card.error')} onRetry={() => render.mutate()} />
        )}

        {share.isError && mediaId !== null && sharedPostId === null && (
          <InlineError message={t('ai.card.shareError')} onRetry={() => share.mutate()} />
        )}

        {/* PNG đã có thật thì mới lưu về máy được */}
        {mediaId && (
          <Button
            label={savedToDevice ? t('ai.card.savedToPhotos') : t('ai.card.saveToPhotos')}
            variant="neutral"
            size="large"
            fullWidth
            loading={saveToDevice.isPending}
            disabled={savedToDevice}
            onPress={() => saveToDevice.mutate()}
            renderIcon={({ size, color }) =>
              savedToDevice ? (
                <Check size={size} color={color} strokeWidth={2.6} />
              ) : (
                <Download size={size} color={color} strokeWidth={2.1} />
              )
            }
          />
        )}

        {sharedPostId && (
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text variant="caption" color={colors.text.secondary} style={{ textAlign: 'center' }}>
              {t('ai.card.shared')}
            </Text>
            <Button
              label={t('ai.card.viewPost')}
              variant="ghost"
              size="small"
              align="center"
              onPress={() => router.push(`/post/${sharedPostId}`)}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

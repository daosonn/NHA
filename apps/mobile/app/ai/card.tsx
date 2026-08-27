import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Download, PenLine, Share2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';

import { InlineError } from '../../src/components/ai/inline-error';
import { Pill } from '../../src/components/ai/pill';
import { SectionLabel } from '../../src/components/ai/section-label';
import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useToast } from '../../src/components/ui/toast';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useSession } from '../../src/features/auth/session';
import { ai, apiAccessToken, media } from '../../src/lib/api';
import type { MessageVariant } from '../../src/lib/api';
import { collapseTo } from '../../src/lib/back';
import { downloadAuthenticated } from '../../src/lib/download';
import { mediaSource } from '../../src/lib/media-source';
import { colors, radius } from '../../src/theme';

/**
 * Màn 26 (11g) — "Make a card": chọn độ dài lời nhắn (Short/Standard/Heartfelt),
 * 15 nền hoa màu nước tự thiết kế (assets/card-templates bên API) có badge
 * "fits", live preview đặt chữ lên ĐÚNG bức tranh sẽ nằm trong PNG; "Save the
 * card" render server-side (0 token); nút share tròn đính PNG lên timeline.
 */

type TemplateId =
  | 't01'
  | 't02'
  | 't03'
  | 't04'
  | 't05'
  | 't06'
  | 't07'
  | 't09'
  | 't10'
  | 't11'
  | 't12'
  | 't13'
  | 't15'
  | 't16'
  | 't17';

/** Chữ nằm ở vùng trống nào của bức tranh — mirror `CardZone` bên API. */
type Zone = 'top' | 'center' | 'lower' | 'right';

/**
 * Bản sao bảng TEMPLATES của `apps/api/src/ai/card.service.ts` (zone + màu) —
 * preview phải nói cùng một điều với PNG. Ảnh nền lấy qua
 * `ai.cardTemplateImageUrl(id)` (route public, cache 1 ngày).
 * maxChars theo vùng: vùng giữa/trên rộng, vùng lệch phải hẹp nhất.
 */
const TEMPLATES: {
  id: TemplateId;
  zone: Zone;
  ink: string;
  accent: string;
  sub: string;
  maxChars: number;
}[] = [
  { id: 't15', zone: 'lower', ink: '#5E4930', accent: '#B06F28', sub: '#9C8867', maxChars: 200 },
  { id: 't01', zone: 'center', ink: '#4A4C3A', accent: '#647353', sub: '#8A8F76', maxChars: 220 },
  { id: 't02', zone: 'top', ink: '#2E3036', accent: '#C26A55', sub: '#8B8E96', maxChars: 240 },
  { id: 't03', zone: 'right', ink: '#6B5260', accent: '#A86379', sub: '#A38A96', maxChars: 140 },
  { id: 't04', zone: 'top', ink: '#664A39', accent: '#B3743F', sub: '#A08874', maxChars: 240 },
  { id: 't05', zone: 'center', ink: '#5B5445', accent: '#AB8A3E', sub: '#948A72', maxChars: 220 },
  { id: 't06', zone: 'center', ink: '#6A4F3C', accent: '#C47A50', sub: '#A78B77', maxChars: 220 },
  { id: 't07', zone: 'center', ink: '#4F4634', accent: '#A2762C', sub: '#8F8468', maxChars: 200 },
  { id: 't09', zone: 'center', ink: '#414D69', accent: '#5F74A8', sub: '#7F89A3', maxChars: 220 },
  { id: 't10', zone: 'center', ink: '#494E42', accent: '#6D7D4E', sub: '#878E7C', maxChars: 220 },
  { id: 't11', zone: 'center', ink: '#5A4A2B', accent: '#A9822F', sub: '#998A68', maxChars: 220 },
  { id: 't12', zone: 'center', ink: '#74424E', accent: '#B8617A', sub: '#A5838E', maxChars: 200 },
  { id: 't13', zone: 'center', ink: '#7C5260', accent: '#C26B85', sub: '#AA8A96', maxChars: 220 },
  { id: 't16', zone: 'top', ink: '#565142', accent: '#9C7A52', sub: '#918A76', maxChars: 240 },
  { id: 't17', zone: 'lower', ink: '#575065', accent: '#8878AD', sub: '#8F8A9E', maxChars: 200 },
];

/** Overlay chữ của preview đặt theo vùng trống — mirror cách neo của server. */
const ZONE_STYLE: Record<Zone, object> = {
  top: { justifyContent: 'flex-start', paddingTop: '9%' },
  center: { justifyContent: 'center' },
  lower: { justifyContent: 'center', paddingTop: '36%' },
  right: { justifyContent: 'center', paddingLeft: '36%' },
};

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
    memberId?: string;
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
  const [template, setTemplate] = useState<TemplateId>('t15');
  const [message, setMessage] = useState(
    variants.find((v) => v.length === (variants[1]?.length ?? 'standard'))?.text ??
      variants[0]?.text ??
      '',
  );
  const [mediaId, setMediaId] = useState<string | null>(null);
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
    setSavedToDevice(false);
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

  /**
   * Bảo đảm có bản PNG thật trên server — render nếu chưa có. Cả Lưu lẫn
   * Share đều cần bước này, nên nó là một hàm chứ không phải một nút.
   */
  const ensureRendered = async (): Promise<string | null> => {
    if (mediaId) return mediaId;
    try {
      const r = await render.mutateAsync();
      return r.media_id;
    } catch {
      // render.isError đã bật — InlineError bên dưới nói và cho thử lại
      return null;
    }
  };

  // Lưu PNG về máy — cùng pattern với `app/video/[id].tsx` (web: blob + bearer,
  // native: import động expo-media-library vì nó không có module web).
  // Nhận id tường minh thay vì đọc state: ngay sau render xong state chưa kịp
  // cập nhật trong cùng tick.
  const saveToDevice = useMutation({
    mutationFn: async (id: string) => {
      const url = media.streamUrl(id);
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
      const target = `${FileSystem.cacheDirectory}nha-card-${id}.png`;
      const dl = await FileSystem.downloadAsync(url, target, {
        headers: { authorization: `Bearer ${apiAccessToken() ?? ''}` },
      });
      await MediaLibrary.saveToLibraryAsync(dl.uri);
    },
    onSuccess: () => {
      setSavedToDevice(true);
      // Popup thay vì mọc thêm nút trạng thái (Sơn chốt 26/08)
      toast.success(t('ai.card.savedToPhotos'));
    },
    onError: () => toast.failure(t('ai.card.saveFailed')),
  });

  /** Lưu = render (nếu cần) + tải về máy, MỘT nút một mạch. */
  const saveCard = async () => {
    const id = await ensureRendered();
    if (id) saveToDevice.mutate(id);
  };

  /**
   * Share KHÔNG đăng bài nữa — đưa thiệp qua màn soạn bài để người dùng
   * DUYỆT: ảnh là thiệp vừa render, tag sẵn người nhận, caption gợi ý sẵn;
   * thêm sửa xóa gì rồi tự bấm đăng (Sơn chốt 26/08).
   */
  const shareToComposer = async () => {
    const id = await ensureRendered();
    if (!id) return;
    router.push({
      pathname: '/new',
      params: {
        attachMediaId: id,
        attachMime: 'image/png',
        tagMemberId: params.memberId ?? '',
        caption: t('ai.card.shareCaption', { name: toName }),
      },
    });
  };

  const active = TEMPLATES.find((x) => x.id === template)!;
  // Vượt khuôn mẫu đang chọn bao nhiêu ký tự (>0 là quá dài).
  const overBy = message.trim().length - active.maxChars;

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={
          // Thiệp ĐÃ lưu thì "quay lại" nghĩa là xong việc — về thẳng hub AI,
          // không bắt người dùng lùi qua màn lời chúc nữa. Chưa lưu thì back
          // thường (còn quay về sửa lời chúc được).
          mediaId ? (
            <BackButton onPress={() => collapseTo(router, '/ai')} />
          ) : (
            <BackButton fallback="/ai" />
          )
        }
        center={<ScreenTitle title={t('ai.card.title')} />}
      />

      <ScrollView
        contentContainerStyle={{
          ...contentColumn,
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

        {/* DESIGN — 15 nền tự thiết kế, badge "fits" khi lời nhắn vừa khuôn */}
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
                    height: 104,
                    borderRadius: radius.xl,
                    overflow: 'hidden',
                    borderWidth: selected ? 2.5 : 1,
                    borderColor: selected ? colors.coral.primary : colors.state.borderNeutral,
                    backgroundColor: colors.background.subtle,
                  }}
                >
                  {/* Thumbnail là ĐÚNG bức tranh của mẫu — mấy vạch màu giả chữ
                      của bản 5 mẫu cũ không nói được thiệp hoa trông thế nào. */}
                  <Image
                    source={{ uri: ai.cardTemplateImageUrl(tp.id) }}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                    contentFit="cover"
                    transition={120}
                  />
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

        {/* Live preview: PNG thật sau khi render, còn lại là chữ đặt sống lên tranh */}
        {mediaId && !imageFailed ? (
          <Image
            source={mediaSource(mediaId)}
            style={{ width: '100%', aspectRatio: 1080 / 1440, borderRadius: radius.xl }}
            contentFit="cover"
            transition={150}
            // PNG tải hỏng thì quay về preview sống thay vì ô trống — nhưng PNG
            // vẫn tồn tại trên server, nên trạng thái đã-lưu/chia-sẻ giữ nguyên.
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View
            style={{
              aspectRatio: 1080 / 1440,
              borderRadius: radius.xl,
              overflow: 'hidden',
              backgroundColor: colors.background.subtle,
              boxShadow: '0 10px 26px rgba(24,24,27,0.16)',
            }}
          >
            {/* Nền là ĐÚNG bức tranh của mẫu — chữ đặt vào vùng trống của nó,
                cùng cách neo với PNG server (bảng TEMPLATES + ZONE_STYLE). */}
            <Image
              source={{ uri: ai.cardTemplateImageUrl(active.id) }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              contentFit="cover"
              transition={150}
            />

            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                paddingHorizontal: '9%',
                ...ZONE_STYLE[active.zone],
              }}
            >
              <View style={{ maxWidth: 250, gap: 9 }}>
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
                  <Text
                    serif
                    weight="bold"
                    color={active.accent}
                    style={{
                      textAlign: 'center',
                      fontSize: 23,
                      lineHeight: 29,
                      fontStyle: 'italic',
                    }}
                  >
                    {t('ai.card.dear', { name: toName })}
                  </Text>
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

        {/* HAI việc, HAI nút, không mọc thêm nút trạng thái nào (Sơn chốt
            26/08): Lưu = render + tải PNG về máy, báo bằng toast; nút tròn =
            đưa thiệp qua màn soạn bài để DUYỆT rồi mới đăng. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button
              label={
                render.isPending
                  ? t('ai.card.rendering')
                  : savedToDevice
                    ? t('ai.card.savedToPhotos')
                    : t('ai.card.saveToPhotos')
              }
              variant="primary"
              size="large"
              fullWidth
              loading={render.isPending || saveToDevice.isPending}
              disabled={!familyId || message.trim().length === 0 || overBy > 0 || savedToDevice}
              onPress={() => void saveCard()}
              renderIcon={({ size, color }) =>
                savedToDevice ? (
                  <Check size={size} color={color} strokeWidth={2.6} />
                ) : (
                  <Download size={size} color={color} strokeWidth={2.1} />
                )
              }
            />
          </View>
          <Pressable
            onPress={() => void shareToComposer()}
            accessibilityRole="button"
            accessibilityLabel={t('ai.card.share')}
            disabled={!familyId || message.trim().length === 0 || overBy > 0}
            style={({ pressed }) => ({
              width: 52,
              height: 52,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.state.borderNeutral,
              backgroundColor: pressed ? colors.background.subtle : colors.background.card,
            })}
          >
            {render.isPending ? (
              <ActivityIndicator
                size="small"
                color={colors.coral.brand}
                style={{ width: 16, height: 16 }}
              />
            ) : (
              <Share2 size={20} color={colors.text.primary} strokeWidth={2.1} />
            )}
          </Pressable>
        </View>

        {/* render hỏng: nói ra + cho bấm thử lại ngay tại chỗ */}
        {render.isError && (
          <InlineError message={t('ai.card.error')} onRetry={() => render.mutate()} />
        )}

        {/* Lối ra tử tế sau khi lưu: một bấm về hub, khỏi lùi qua từng màn */}
        {mediaId && (
          <Button
            label={t('common.done')}
            variant="ghost"
            size="large"
            fullWidth
            align="center"
            onPress={() => collapseTo(router, '/ai')}
          />
        )}
      </ScrollView>
    </View>
  );
}

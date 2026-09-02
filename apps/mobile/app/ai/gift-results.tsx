import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ExternalLink,
  Eye,
  Gift,
  Heart,
  RotateCw,
  Sparkles,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';

import { InlineError } from '../../src/components/ai/inline-error';
import { Sheet } from '../../src/components/ai/sheet';
import { SourceChip } from '../../src/components/ai/source-chip';
import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { Chip } from '../../src/components/ui/chip';
import { EmptyState } from '../../src/components/ui/empty-state';
import { PhotoPlaceholder } from '../../src/components/ui/photo-placeholder';
import { Text } from '../../src/components/ui/text';
import { useToast } from '../../src/components/ui/toast';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useAiLocale } from '../../src/features/ai/use-ai-locale';
import { useGiftIdeas, useSaveGiftIdea } from '../../src/features/ai/use-gift-ideas';
import { ai, ApiError } from '../../src/lib/api';
import type { GiftIdeaResult, GiftIdeasResponse, GiftSource } from '../../src/lib/api';
import { mediaSource } from '../../src/lib/media-source';
import { formatFullDate } from '../../src/lib/date';
import { colors, radius, spacing } from '../../src/theme';

/**
 * Màn 22 (11b) — "All five ideas in one scroll, each with its sources and where to buy"
 * + màn 23 (11d) — "Tap a source to see the photo it came from" (bottom sheet).
 *
 * Provenance đứng TRƯỚC ý tưởng; kiêng kỵ cứng ("Worth knowing") không bao giờ bị ẩn.
 */

/** Nguồn đang mở trong sheet 11d — kèm ý tưởng chứa nó để "Also from" + Save. */
type OpenSource = { source: GiftSource; idea: GiftIdeaResult | null };

export default function GiftResultsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { familyId } = useActiveFamily();
  const params = useLocalSearchParams<{
    memberId: string;
    memberName: string;
    occasion: string;
    occasionDate: string;
    budget: string;
  }>();

  const ideas = useGiftIdeas(familyId, params.memberId ?? null);
  const save = useSaveGiftIdea(familyId, params.memberId ?? null);
  const locale = useAiLocale();
  const toast = useToast();
  const [savedTitles, setSavedTitles] = useState<string[]>([]);
  /** Kết quả thành công gần nhất — giữ lại để regenerate không xoá trắng màn hình. */
  const [held, setHeld] = useState<GiftIdeasResponse | null>(null);
  const [open, setOpen] = useState<OpenSource | null>(null);

  /** Lượt hỏi gần nhất có force hay không — retry phải lặp lại ĐÚNG lượt đã hỏng,
   * không được âm thầm hạ xuống bản cache. */
  const lastForce = useRef(false);

  /** `force` = nút ↻: bỏ qua cache, hỏi AI lại (mất token, nên phải do người bấm). */
  const ask = (force = lastForce.current) => {
    lastForce.current = force;
    ideas.mutate(
      {
        // phòng thủ 80 ký tự — params có thể tới từ deep link ngoài màn ask
        occasionLabel: params.occasion.slice(0, 80),
        occasionDate: params.occasionDate || undefined,
        budgetLabel: params.budget,
        locale, // ý tưởng phải cùng ngôn ngữ với màn hình người dùng đang xem
        maxIdeas: 5, // design 11b: "All five ideas in one scroll"

        force,
      },
      { onSuccess: (result) => setHeld(result) },
    );
  };

  useEffect(() => {
    if (familyId && params.memberId && params.occasion) ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, params.memberId, params.occasion, params.budget]);

  const data = held;
  const counts = data?.evidence_read ?? {};

  /** Saved = đã lưu từ trước (server trả về) ∪ vừa lưu lượt này (optimistic). */
  const savedSet = new Set([...(data?.saved_ideas ?? []).map((s) => s.title), ...savedTitles]);

  /** 503 AI_UNAVAILABLE → câu "AI đang tắt"; lỗi khác dùng câu chung. */
  const ideasErrorMessage =
    ideas.error instanceof ApiError && !ideas.error.isAiUnavailable
      ? t('errors.generic')
      : t('ai.gifts.error');

  /**
   * Sheet 11d — lần theo nguồn AI đã trích. Nguồn giờ là `sig_…` (signal trong hồ
   * sơ) hoặc `memo_…`, nên server lần hộ: signal → bài gốc + ảnh, memo → nguyên văn.
   */
  const source = useQuery({
    queryKey: ['evidence', params.memberId ?? 'none', open?.source.evidence_id ?? 'none'],
    queryFn: () => ai.evidence(familyId as string, params.memberId, [open!.source.evidence_id]),
    enabled: familyId !== null && !!params.memberId && open !== null,
  });
  const resolved = source.data?.[0] ?? null;

  const onSave = (idea: GiftIdeaResult) => {
    if (savedSet.has(idea.title)) return;
    setSavedTitles((current) => [...current, idea.title]);
    save.mutate(
      {
        title: idea.title,
        why: idea.why,
        priceRange: idea.price_range ?? undefined,
        occasionLabel: params.occasion.slice(0, 80),
      },
      {
        onSuccess: () => toast.success(t('ai.gifts.savedToast')),
        onError: () => {
          // rollback optimistic — nút trở lại "Save" để bấm lại được
          setSavedTitles((current) => current.filter((title) => title !== idea.title));
          toast.failure(t('ai.gifts.saveFailed'));
        },
      },
    );
  };

  /** Mở đúng trang tìm kiếm của sàn với từ khoá tiếng Nhật + dải giá đã dùng. */
  const openShop = (idea: GiftIdeaResult) => {
    const kw = idea.resolve?.keyword_ja || idea.search_keywords_ja;
    if (!kw) return;
    const range = idea.resolve
      ? `&price_from=${idea.resolve.price_min}&price_to=${idea.resolve.price_max}`
      : '';
    void Linking.openURL(
      `https://shopping.yahoo.co.jp/search?p=${encodeURIComponent(kw)}${range}`,
    ).catch(() => toast.failure(t('ai.gifts.linkFailed')));
  };

  // familyId chưa về là trạng thái TẠM (đang đọc families/AsyncStorage) — chờ,
  // đừng chớp màn "thiếu ngữ cảnh" rồi lại đổi ý.
  if (familyId === null && params.memberId && params.occasion) {
    return (
      <View className="flex-1 bg-page">
        <AppHeader
          left={<BackButton fallback="/ai" />}
          center={<ScreenTitle title={t('ai.gifts.title')} />}
          paddingRight={spacing.lg}
        />
        <View style={{ paddingTop: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.coral.primary} />
        </View>
      </View>
    );
  }

  // Mở thẳng màn 22 mà thiếu ngữ cảnh (deep link cũ…) — chỉ về form, không heading "undefined".
  if (!familyId || !params.memberId || !params.occasion) {
    return (
      <View className="flex-1 bg-page">
        <AppHeader
          left={<BackButton fallback="/ai" />}
          center={<ScreenTitle title={t('ai.gifts.title')} />}
          paddingRight={spacing.lg}
        />
        <EmptyState
          renderIcon={({ size, color }) => <Gift size={size} color={color} strokeWidth={2.1} />}
          title={t('ai.gifts.missingTitle')}
          description={t('ai.gifts.missingBody')}
          actionLabel={t('ai.gifts.missingAction')}
          onActionPress={() => router.replace('/ai/gifts')}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton fallback="/ai" />}
        center={<ScreenTitle title={t('ai.gifts.title')} />}
        right={
          <Pressable
            onPress={() => {
              if (!ideas.isPending) ask(true);
            }}
            disabled={ideas.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('ai.gifts.regenerate')}
            accessibilityState={{ disabled: ideas.isPending }}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.55 : 1,
            })}
          >
            <RotateCw
              size={18}
              color={ideas.isPending ? colors.state.disabledText : colors.text.primary}
              strokeWidth={2.1}
            />
          </Pressable>
        }
        paddingRight={spacing.lg}
      />

      <ScrollView
        contentContainerStyle={{
          ...contentColumn,
          paddingTop: 14,
          paddingBottom: 40,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 4 }}>
          <Text serif weight="bold" style={{ fontSize: 25, lineHeight: 31, letterSpacing: -0.4 }}>
            {data
              ? t('ai.gifts.resultsTitle', {
                  count: data.ideas.length,
                  name: params.memberName ?? '',
                })
              : t('ai.gifts.title')}
          </Text>
          <Text variant="caption" color={colors.text.muted}>
            {params.occasion}
          </Text>
        </View>

        {ideas.isPending && (
          <Card padding={20} style={{ alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={colors.coral.primary} />
            <Text variant="caption" color={colors.text.body}>
              {t('ai.gifts.loading')}
            </Text>
          </Card>
        )}

        {/* Có kết quả cũ thì lỗi hiện TRÊN danh sách; chưa có gì thì card lỗi đứng một mình */}
        {ideas.isError && <InlineError message={ideasErrorMessage} onRetry={() => ask()} />}

        {/* Lượt hỏi trả về 0 ý tưởng — nói vì sao và mời thử lại (force, vì cache đã rỗng).
            Lỗi thì nhường chỗ cho card lỗi ở trên: hai nút retry chồng nhau là đánh đố. */}
        {data && data.ideas.length === 0 && !ideas.isPending && !ideas.isError && (
          <EmptyState
            renderIcon={({ size, color }) => <Gift size={size} color={color} strokeWidth={2.1} />}
            title={t('ai.gifts.noIdeasTitle')}
            description={t('ai.gifts.noIdeasBody')}
            actionLabel={t('common.retry')}
            onActionPress={() => ask(true)}
          />
        )}

        {data && data.ideas.length > 0 && (
          <View style={{ gap: 12, opacity: ideas.isPending ? 0.55 : 1 }}>
            {/* Lượt này từ cache (0 token) — nói ra để nút ↻ có nghĩa */}
            {data.cached && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    paddingHorizontal: 8,
                    height: 20,
                    justifyContent: 'center',
                    borderRadius: radius.full,
                    backgroundColor: colors.themes.hobbies.bg,
                  }}
                >
                  <Text variant="badge" weight="semibold" color={colors.themes.hobbies.text}>
                    {t('ai.gifts.cachedRound')}
                  </Text>
                </View>
                <Text variant="badge" color={colors.text.subtle}>
                  {t('ai.gifts.tapRefresh')}
                </Text>
              </View>
            )}

            {/* Kiêng kỵ cứng — "Worth knowing." Không thu gọn, không ẩn. */}
            {data.note_to_giver && (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  padding: 12,
                  borderRadius: radius.xl,
                  backgroundColor: '#FDF3E7',
                  borderWidth: 1,
                  borderColor: '#F0D9BC',
                }}
              >
                <AlertTriangle size={15} color="#B07B2E" strokeWidth={2.2} />
                <Text variant="caption" color={colors.text.body} style={{ flex: 1 }}>
                  <Text variant="caption" weight="bold" color="#8A5E1E">
                    {t('ai.gifts.worthKnowing')}{' '}
                  </Text>
                  {data.note_to_giver}
                </Text>
              </View>
            )}

            {/* "What we noticed" — quan sát nền + nguồn, TRƯỚC các ý tưởng */}
            {data.insights.length > 0 && (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Eye size={15} color={colors.coral.hover} strokeWidth={2.2} />
                  <Text variant="body2" weight="bold">
                    {t('ai.gifts.whatWeNoticed')}
                  </Text>
                </View>
                {data.insights.map((insight) => (
                  <Card key={insight.text} padding={13} style={{ gap: 9 }}>
                    <Text variant="body2" color={colors.text.secondary}>
                      {insight.text}
                    </Text>
                    {insight.sources.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {insight.sources.map((s) => (
                          <SourceChip
                            key={s.evidence_id}
                            label={s.label}
                            onPress={() => setOpen({ source: s, idea: null })}
                          />
                        ))}
                      </View>
                    )}
                  </Card>
                ))}
              </View>
            )}

            {/* Đọc bao nhiêu bằng chứng — hiện TRƯỚC ý tưởng đầu tiên */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 13,
                borderRadius: radius.lg,
                backgroundColor: colors.background.subtle,
              }}
            >
              <Sparkles size={14} color={colors.text.muted} strokeWidth={2.2} />
              <Text variant="caption" color={colors.text.body} style={{ flex: 1 }}>
                {t('ai.gifts.evidenceRead', {
                  notes: counts.notes ?? 0,
                  photos: counts.photos ?? 0,
                  gifts: counts.past_gifts ?? 0,
                })}
              </Text>
            </View>

            {data.mock && (
              <Text variant="badge" color={colors.text.subtle}>
                {t('ai.mockBadge')}
              </Text>
            )}

            <View style={{ gap: 12 }}>
              {data.ideas.map((idea) => (
                <Card key={idea.title} padding={14} style={{ gap: 10 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <Text variant="body1" weight="bold" style={{ flex: 1, letterSpacing: -0.15 }}>
                      {idea.title}
                    </Text>
                    <Chip
                      label={
                        idea.kind === 'together'
                          ? t('ai.gifts.kindTogether')
                          : t('ai.gifts.kindGift')
                      }
                      theme={idea.kind === 'together' ? 'memories' : 'gift'}
                      showDot
                    />
                  </View>

                  {/* nhóm quà, in hoa nhỏ — "LÀM VƯỜN", "THỰC DỤNG" */}
                  {!!idea.category && (
                    <Text
                      variant="badge"
                      weight="medium"
                      color={colors.text.lightMuted}
                      style={{ letterSpacing: 0.8, textTransform: 'uppercase', marginTop: -4 }}
                    >
                      {idea.category}
                    </Text>
                  )}

                  {/* why — chữ xám thường, đúng mockup 11b */}
                  <Text variant="caption" color={colors.text.body}>
                    {idea.why}
                  </Text>

                  {idea.sources.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {idea.sources.map((s) => (
                        <SourceChip
                          key={s.evidence_id}
                          label={s.label}
                          onPress={() => setOpen({ source: s, idea })}
                        />
                      ))}
                    </View>
                  )}

                  {idea.price_range && (
                    <Text variant="body2" weight="bold">
                      {idea.price_range}{' '}
                      <Text variant="badge" color={colors.text.subtle}>
                        {t('ai.gifts.priceAbout')}
                      </Text>
                    </Text>
                  )}

                  {/* tags do AI gán: "trải nghiệm", "linh hoạt", "không phải cúi" */}
                  {idea.tags.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {idea.tags.slice(0, 4).map((tag) => (
                        <View
                          key={tag}
                          style={{
                            paddingHorizontal: 8,
                            height: 20,
                            justifyContent: 'center',
                            borderRadius: radius.full,
                            backgroundColor: colors.background.subtle,
                          }}
                        >
                          <Text variant="badge" color={colors.text.secondary}>
                            {tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* "One in stock near this price" — sản phẩm THẬT (Yahoo JP) */}
                  {idea.products.length > 0 && (
                    <View
                      style={{
                        gap: 8,
                        padding: 11,
                        borderRadius: radius.xl,
                        backgroundColor: colors.background.surfaceSoft,
                        borderWidth: 1,
                        borderColor: colors.state.borderDefault,
                      }}
                    >
                      {/* hàng badge giải thích: cache · đã nới · đã loại vì kiêng kỵ */}
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Text variant="badge" weight="bold" color={colors.text.secondary}>
                          {t('ai.gifts.inStock', { count: idea.products.length })}
                        </Text>
                        {idea.resolve?.cached && (
                          <View
                            style={{
                              paddingHorizontal: 7,
                              height: 18,
                              justifyContent: 'center',
                              borderRadius: radius.full,
                              backgroundColor: colors.themes.hobbies.bg,
                            }}
                          >
                            <Text
                              variant="badge"
                              weight="semibold"
                              color={colors.themes.hobbies.text}
                            >
                              {t('ai.gifts.fromCache')}
                            </Text>
                          </View>
                        )}
                        {!!idea.resolve?.relaxed && (
                          <View
                            style={{
                              paddingHorizontal: 7,
                              height: 18,
                              justifyContent: 'center',
                              borderRadius: radius.full,
                              backgroundColor: colors.themes.todo.bg,
                            }}
                          >
                            <Text variant="badge" weight="semibold" color={colors.themes.todo.text}>
                              {t('ai.gifts.widened')}
                            </Text>
                          </View>
                        )}
                        {(idea.resolve?.dropped_by_avoid ?? 0) > 0 && (
                          <View
                            style={{
                              paddingHorizontal: 7,
                              height: 18,
                              justifyContent: 'center',
                              borderRadius: radius.full,
                              backgroundColor: '#FDF3E7',
                            }}
                          >
                            <Text variant="badge" weight="semibold" color="#8A5E1E">
                              {t('ai.gifts.droppedByAvoid', {
                                count: idea.resolve!.dropped_by_avoid,
                              })}
                            </Text>
                          </View>
                        )}
                      </View>
                      {idea.products.map((p) => (
                        <Pressable
                          key={p.url}
                          onPress={() =>
                            void Linking.openURL(p.url).catch(() =>
                              toast.failure(t('ai.gifts.linkFailed')),
                            )
                          }
                          accessibilityRole="link"
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                        >
                          {p.image ? (
                            <Image
                              source={{ uri: p.image }}
                              style={{
                                width: 46,
                                height: 46,
                                borderRadius: radius.lg,
                                backgroundColor: colors.background.subtle,
                              }}
                              contentFit="cover"
                            />
                          ) : (
                            <PhotoPlaceholder
                              style={{ width: 46, height: 46, borderRadius: radius.lg }}
                            />
                          )}
                          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                            <Text variant="caption" numberOfLines={2}>
                              {p.name}
                            </Text>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                flexWrap: 'wrap',
                              }}
                            >
                              <Text variant="body2" weight="bold">
                                {p.price.toLocaleString('ja-JP')}円
                              </Text>
                              <View
                                style={{
                                  paddingHorizontal: 7,
                                  height: 18,
                                  justifyContent: 'center',
                                  borderRadius: radius.full,
                                  backgroundColor: colors.themes.gift.bg,
                                }}
                              >
                                <Text
                                  variant="badge"
                                  weight="semibold"
                                  color={colors.themes.gift.text}
                                >
                                  Yahoo!ショッピング
                                </Text>
                              </View>
                              <Text variant="badge" color={colors.text.subtle}>
                                {p.review_rate ? `★${p.review_rate}` : ''}
                                {p.review_rate && p.store ? ' · ' : ''}
                                {p.store ?? ''}
                              </Text>
                            </View>
                          </View>
                          <ExternalLink
                            size={14}
                            color={colors.text.lightMuted}
                            strokeWidth={2.1}
                          />
                        </Pressable>
                      ))}

                      {/* từ khoá đã dùng — người dùng tự tìm thêm được */}
                      {!!idea.resolve?.keyword_ja && (
                        <Text variant="badge" color={colors.text.subtle}>
                          {t('ai.gifts.keywordJp')} {idea.resolve.keyword_ja}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Không tra được sản phẩm: nói rõ vì sao rồi mới mời tự tìm */}
                  {idea.products.length === 0 && (
                    <Text variant="badge" color={colors.text.subtle}>
                      {data.shops_enabled
                        ? idea.resolve?.error
                          ? t('ai.gifts.shopCheckFailed')
                          : t('ai.gifts.noProducts')
                        : t('ai.gifts.shopsOff')}
                    </Text>
                  )}

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      label={savedSet.has(idea.title) ? t('ai.gifts.saved') : t('ai.gifts.save')}
                      variant={savedSet.has(idea.title) ? 'secondary' : 'neutral'}
                      size="small"
                      accessibilityState={{ selected: savedSet.has(idea.title) }}
                      onPress={() => onSave(idea)}
                      renderIcon={({ size, color }) => (
                        <Heart
                          size={size}
                          color={color}
                          strokeWidth={2.1}
                          fill={savedSet.has(idea.title) ? color : 'transparent'}
                        />
                      )}
                    />
                    {!!idea.search_keywords_ja && (
                      <Button
                        label={t('ai.gifts.whereToBuy')}
                        variant="neutral"
                        size="small"
                        onPress={() => openShop(idea)}
                        renderIcon={({ size, color }) => (
                          <ExternalLink size={size} color={color} strokeWidth={2.1} />
                        )}
                      />
                    )}
                  </View>
                </Card>
              ))}
            </View>

            <Text variant="badge" color={colors.text.subtle} style={{ textAlign: 'center' }}>
              {t('ai.privacyFooter')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ---------- màn 23 (11d): "Where this came from" ---------- */}
      <Sheet
        visible={open !== null}
        onClose={() => setOpen(null)}
        title={t('ai.gifts.sourceTitle')}
        subtitle={
          resolved?.created_at
            ? `${open?.source.label ?? ''} · ${formatFullDate(resolved.created_at.slice(0, 10)) ?? ''}`
            : (open?.source.label ?? '')
        }
      >
        {source.isPending && (
          <View style={{ paddingVertical: 18, alignItems: 'center' }}>
            <ActivityIndicator color={colors.coral.primary} />
          </View>
        )}

        {resolved?.media_id && (
          <Image
            source={mediaSource(resolved.media_id)}
            style={{
              width: '100%',
              aspectRatio: 4 / 3,
              borderRadius: radius['2xl'],
              backgroundColor: colors.background.subtle,
            }}
            contentFit="cover"
          />
        )}

        {/* Điều app đã ghi nhận từ nguồn này (topic của signal) */}
        {!!resolved?.topic && (
          <Text variant="body2" weight="semibold">
            {resolved.topic}
          </Text>
        )}

        {/* Tra nguồn thất bại ≠ nguồn đã mất — thất bại thì mời thử lại, không đổ cho bài gốc */}
        {source.isError ? (
          <View style={{ gap: 10 }}>
            <Text variant="body2" color={colors.text.body}>
              {t('ai.gifts.sourceLoadFailed')}
            </Text>
            <Button
              label={t('common.retry')}
              variant="secondary"
              size="small"
              onPress={() => void source.refetch()}
            />
          </View>
        ) : resolved?.text ? (
          <Text variant="body2" color={colors.text.secondary}>
            {resolved.kind === 'memo' ? `“${resolved.text}”` : `“${resolved.text}”`}
            {resolved.author_name ? (
              <Text variant="badge" color={colors.text.subtle}>
                {'  '}
                {t('ai.gifts.sourceBy', { name: resolved.author_name })}
              </Text>
            ) : null}
          </Text>
        ) : !source.isPending ? (
          <Text variant="body2" color={colors.text.body}>
            {t('ai.gifts.sourceGone')}
          </Text>
        ) : null}

        {/* Also from — các nguồn còn lại của cùng ý tưởng */}
        {(open?.idea?.sources.filter((s) => s.evidence_id !== open.source.evidence_id).length ??
          0) > 0 && (
          <View style={{ gap: 7 }}>
            <Text
              variant="badge"
              weight="semibold"
              color={colors.text.lightMuted}
              style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}
            >
              {t('ai.gifts.alsoFrom')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {open!
                .idea!.sources.filter((s) => s.evidence_id !== open!.source.evidence_id)
                .map((s) => (
                  <SourceChip
                    key={s.evidence_id}
                    label={s.label}
                    onPress={() => setOpen({ source: s, idea: open!.idea })}
                  />
                ))}
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 }}>
          {resolved?.post_id && (
            <View style={{ flex: 1 }}>
              <Button
                label={t('ai.gifts.openPost')}
                variant="primary"
                fullWidth
                onPress={() => {
                  const postId = resolved.post_id!;
                  setOpen(null);
                  router.push(`/post/${postId}`);
                }}
              />
            </View>
          )}
          {open?.idea && (
            <Pressable
              onPress={() => {
                onSave(open.idea!);
                setOpen(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={
                savedSet.has(open.idea.title) ? t('ai.gifts.saved') : t('ai.gifts.save')
              }
              accessibilityState={{ selected: savedSet.has(open.idea.title) }}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: radius.full,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.state.borderNeutral,
                backgroundColor: pressed ? colors.background.subtle : colors.background.card,
              })}
            >
              <Heart
                size={18}
                color={savedSet.has(open.idea.title) ? colors.coral.hover : colors.text.secondary}
                strokeWidth={2.1}
                fill={savedSet.has(open.idea.title) ? colors.coral.hover : 'transparent'}
              />
            </Pressable>
          )}
        </View>
      </Sheet>
    </View>
  );
}

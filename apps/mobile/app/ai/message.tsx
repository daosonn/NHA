import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronDown, Copy, Gift, RotateCw, Sparkles } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { DateTile } from '../../src/components/ai/date-tile';
import { InlineError } from '../../src/components/ai/inline-error';
import { MemberSheet } from '../../src/components/ai/member-sheet';
import { OccasionSheet, type OccasionChoice } from '../../src/components/ai/occasion-sheet';
import { Pill } from '../../src/components/ai/pill';
import { SectionLabel } from '../../src/components/ai/section-label';
import { SelectRow } from '../../src/components/ai/select-row';
import { Sheet } from '../../src/components/ai/sheet';
import { SourceChip } from '../../src/components/ai/source-chip';
import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Avatar } from '../../src/components/ui/avatar';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { IconBadge } from '../../src/components/ui/icon-badge';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useToast } from '../../src/components/ui/toast';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useAiLocale } from '../../src/features/ai/use-ai-locale';
import { useMessageSuggestions } from '../../src/features/ai/use-gift-ideas';
import { useSpecialDates } from '../../src/features/ai/use-special-dates';
import { ai, ApiError, families } from '../../src/lib/api';
import type { MessageResponse, MessageVariant } from '../../src/lib/api';
import { queryKeys } from '../../src/lib/query-keys';
import { colors, radius, spacing } from '../../src/theme';

/**
 * Màn 24 (11e) "Three ways to say it" + màn 25 (11f) "Say it differently".
 * 3 biến thể short/standard/heartfelt kèm evidence chips + nút copy; đổi giọng
 * (Warmer / More formal) = gọi lại; "Put this on a card" mang CẢ 3 biến thể sang màn 26.
 */

const LENGTH_LABEL: Record<MessageVariant['length'], { key: string; hint: string }> = {
  short: { key: 'ai.message.short', hint: 'ai.message.shortHint' },
  standard: { key: 'ai.message.standard', hint: 'ai.message.standardHint' },
  heartfelt: { key: 'ai.message.heartfelt', hint: 'ai.message.heartfeltHint' },
};

export default function MessageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { familyId } = useActiveFamily();
  const { user } = useSession();
  const params = useLocalSearchParams<{
    memberId?: string;
    memberName?: string;
    occasion?: string;
    occasionDate?: string;
  }>();

  const family = useQuery({
    queryKey: queryKeys.family(familyId ?? 'none'),
    queryFn: () => families.detail(familyId as string),
    enabled: familyId !== null,
  });
  const members = useMemo(() => family.data?.members ?? [], [family.data]);
  const dates = useSpecialDates(familyId);

  const [memberId, setMemberId] = useState<string | null>(params.memberId ?? null);
  const [occasion, setOccasion] = useState<OccasionChoice | null>(
    params.occasion ? { label: params.occasion, date: params.occasionDate ?? null } : null,
  );
  const [extraNote, setExtraNote] = useState('');
  const [tone, setTone] = useState<'warm' | 'formal'>('warm');
  const [memberSheet, setMemberSheet] = useState(false);
  const [occasionSheet, setOccasionSheet] = useState(false);
  const [copied, setCopied] = useState<MessageVariant['length'] | null>(null);
  /** Kết quả cuối cùng thành công — v5 xoá `mutation.data` ngay khi mutate lần sau. */
  const [results, setResults] = useState<MessageResponse | null>(null);
  /** refs (memo_…/sig_…) của biến thể đang mở sheet "Where this came from". */
  const [openSources, setOpenSources] = useState<string[] | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

  // id lỗi thời từ deep link không được lặng lẽ đổi sang người khác
  const target =
    members.find((m) => m.id === memberId) ?? (params.memberId ? null : (members[0] ?? null));
  const suggest = useMessageSuggestions(familyId, target?.id ?? null);
  const locale = useAiLocale();

  // Sheet nguồn — server lần refs về bài/ghi chú thật (như màn 23)
  const sources = useQuery({
    queryKey: ['evidence', target?.id ?? 'none', openSources?.join(',') ?? 'none'],
    queryFn: () => ai.evidence(familyId as string, target!.id, openSources!),
    enabled: familyId !== null && target !== null && openSources !== null,
  });
  const resolvedSources = (sources.data ?? []).filter((r) => r.kind !== 'unknown');

  const occasionDays = occasion?.date
    ? ((dates.data?.items ?? []).find((i) => i.nextOccurrence === occasion.date)?.daysUntil ?? null)
    : null;

  const generate = (nextTone?: 'warm' | 'formal') => {
    const useTone = nextTone ?? tone;
    if (!occasion) {
      // chưa chọn dịp: mở picker thay vì để nút xám chết
      setOccasionSheet(true);
      return;
    }
    // lời nhắn phải viết bằng ngôn ngữ người dùng đang dùng app.
    // force khi màn ĐÃ có kết quả: server giờ cache lời nhắn theo (người, dịp, tone)
    // — "Say it differently" cùng tone mà không force sẽ trả lại nguyên bản cũ.
    suggest.mutate(
      {
        occasionLabel: occasion.label,
        extraNote: extraNote.trim() || undefined,
        tone: useTone,
        locale,
        force: results !== null,
      },
      {
        // Tone chỉ được "chốt" khi có kết quả: đổi giọng thất bại thì pill không
        // được nhận là đã đổi trong khi lời nhắn trên màn vẫn là giọng cũ.
        onSuccess: (data) => {
          setResults(data);
          setTone(useTone);
        },
      },
    );
  };

  /** Đổi người/dịp: lời nhắn viết cho bà không được sống sót sang ông. */
  const resetResults = () => {
    setResults(null);
    suggest.reset();
    setCopied(null);
    setOpenSources(null);
  };

  const copy = (v: MessageVariant) => {
    void Clipboard.setStringAsync(v.text);
    setCopied(v.length);
    toast.success(t('ai.message.copied'));
    if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1600);
  };

  const toCard = () => {
    const variants = results?.variants ?? [];
    router.push({
      pathname: '/ai/card',
      params: {
        variants: JSON.stringify(variants.map((v) => ({ length: v.length, text: v.text }))),
        toName: target?.displayName ?? '',
        occasion: occasion?.label ?? '',
      },
    });
  };

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton fallback="/ai" />}
        center={<ScreenTitle title={t('ai.message.title')} />}
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
        {/* Family chưa về thì không được vẽ 'To ""' — chờ, hoặc nói rõ vì sao hỏng */}
        {familyId !== null && family.isPending && (
          <Card padding={20} style={{ alignItems: 'center' }}>
            <ActivityIndicator color={colors.coral.primary} />
          </Card>
        )}
        {family.isError && !family.data && (
          <InlineError
            message={t('ai.message.loadFamilyFailed')}
            onRetry={() => void family.refetch()}
          />
        )}

        {/* To + Occasion — hai hàng trong MỘT card (11e) */}
        {family.data && (
          <Card padding={8} style={{ gap: 0 }}>
            <SelectRow
              bare
              leading={<Avatar size={38} name={target?.displayName} mediaId={target?.avatarKey} />}
              title={t('ai.message.toName', { name: target?.displayName ?? '' })}
              subtitle={user?.name ? t('ai.message.fromName', { name: user.name }) : null}
              trailing={<ChevronDown size={16} color={colors.text.lightMuted} strokeWidth={2.2} />}
              onPress={() => setMemberSheet(true)}
            />
            <View style={{ height: 1, backgroundColor: colors.state.borderDefault }} />
            <SelectRow
              bare
              leading={
                occasion?.date ? (
                  <DateTile
                    day={Number(occasion.date.slice(8, 10))}
                    month={t(`date.months.${Number(occasion.date.slice(5, 7))}`)}
                  />
                ) : (
                  <IconBadge
                    size={38}
                    renderIcon={({ size, color }) => (
                      <Gift size={size} color={color} strokeWidth={2.1} />
                    )}
                  />
                )
              }
              title={occasion?.label ?? t('ai.gifts.pickOccasion')}
              subtitle={occasionDays !== null ? t('ai.daysAway', { count: occasionDays }) : null}
              onPress={() => setOccasionSheet(true)}
            />
          </Card>
        )}

        {/* ANYTHING TO ADD */}
        <TextField
          label={t('ai.message.anythingToAdd')}
          uppercaseLabel
          value={extraNote}
          onChangeText={setExtraNote}
          placeholder={t('ai.message.anythingPlaceholder')}
        />

        {/* thiếu dịp KHÔNG khoá nút — bấm sẽ mở picker dịp (xem generate) */}
        {!results && !suggest.isPending && (
          <Button
            label={t('ai.message.generate')}
            variant="primary"
            size="large"
            fullWidth
            disabled={!familyId || !target}
            onPress={() => generate()}
            renderIcon={({ size, color }) => (
              <Sparkles size={size} color={color} strokeWidth={2.1} />
            )}
          />
        )}

        {suggest.isPending && (
          <Card padding={20} style={{ alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={colors.coral.primary} />
            <Text variant="caption" color={colors.text.body}>
              {t('ai.message.loading')}
            </Text>
          </Card>
        )}

        {/* thất bại phải nói ra — 503 AI_UNAVAILABLE có câu riêng */}
        {suggest.isError && (
          <InlineError
            message={t(
              suggest.error instanceof ApiError && suggest.error.isAiUnavailable
                ? 'ai.message.aiOff'
                : 'ai.message.error',
            )}
            onRetry={() => generate()}
          />
        )}

        {/* kết quả cầm ở state riêng: regenerate (kể cả thất bại) không phá màn.
            Đang chờ mà đã có kết quả → mờ đi chứ không biến mất. */}
        {results && (
          <View style={{ gap: 12, opacity: suggest.isPending ? 0.55 : 1 }}>
            {results.variants.length === 0 ? (
              <InlineError message={t('ai.message.empty')} onRetry={() => generate()} />
            ) : (
              <>
                {/* "✦ Three ways to say it" */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Sparkles size={15} color={colors.text.secondary} strokeWidth={2.2} />
                  <Text variant="body2" weight="bold">
                    {t('ai.message.threeWays')}
                  </Text>
                </View>

                {results.variants.map((v) => (
                  <Card key={v.length} padding={14} style={{ gap: 9 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text variant="body2" weight="bold" style={{ flex: 1 }}>
                        {t(LENGTH_LABEL[v.length].key)}
                      </Text>
                      <Text variant="badge" color={colors.text.subtle}>
                        {t(LENGTH_LABEL[v.length].hint)}
                      </Text>
                      <Pressable
                        onPress={() => copy(v)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={
                          copied === v.length ? t('ai.message.copied') : t('ai.message.copy')
                        }
                        style={({ pressed }) => ({
                          width: 30,
                          height: 30,
                          borderRadius: radius.full,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: colors.state.borderNeutral,
                          backgroundColor: pressed
                            ? colors.background.subtle
                            : colors.background.card,
                        })}
                      >
                        {copied === v.length ? (
                          <Check size={14} color={colors.coral.hover} strokeWidth={2.4} />
                        ) : (
                          <Copy size={14} color={colors.text.secondary} strokeWidth={2.1} />
                        )}
                      </Pressable>
                    </View>

                    <Text variant="body2" color={colors.text.primary} style={{ lineHeight: 21 }}>
                      {v.text}
                    </Text>

                    {/* refs là memo_…/sig_… (không phải post id) → MỘT chip đếm, bấm mở sheet */}
                    {v.memories_used.length > 0 && (
                      <View style={{ flexDirection: 'row' }}>
                        <SourceChip
                          label={t('ai.message.fromSharedCount', {
                            count: v.memories_used.length,
                          })}
                          onPress={() => setOpenSources(v.memories_used)}
                        />
                      </View>
                    )}
                  </Card>
                ))}

                {/* màn 25 — SAY IT DIFFERENTLY. Bấm lại tone đang chọn = no-op. */}
                <SectionLabel label={t('ai.message.sayDifferently')} />
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}
                >
                  <Pill
                    label={t('ai.message.warmer')}
                    selected={tone === 'warm'}
                    onPress={() => {
                      if (!suggest.isPending && tone !== 'warm') generate('warm');
                    }}
                  />
                  <Pill
                    label={t('ai.message.moreFormal')}
                    selected={tone === 'formal'}
                    onPress={() => {
                      if (!suggest.isPending && tone !== 'formal') generate('formal');
                    }}
                  />
                  <Button
                    label={t('ai.message.tryAgain')}
                    variant="neutral"
                    size="small"
                    loading={suggest.isPending}
                    onPress={() => generate()}
                    renderIcon={({ size, color }) => (
                      <RotateCw size={size} color={color} strokeWidth={2.1} />
                    )}
                  />
                </View>

                <Button
                  label={t('ai.message.putOnCard')}
                  variant="primary"
                  size="large"
                  fullWidth
                  onPress={toCard}
                />

                <Text variant="badge" color={colors.text.subtle} style={{ textAlign: 'center' }}>
                  {t('ai.privacyFooter')}
                </Text>
              </>
            )}
          </View>
        )}
      </ScrollView>

      <MemberSheet
        visible={memberSheet}
        onClose={() => setMemberSheet(false)}
        members={members}
        selectedId={target?.id ?? null}
        loading={familyId !== null && family.isPending}
        error={family.isError && !family.data}
        onRetry={() => void family.refetch()}
        onSelect={(m) => {
          if (m.id !== target?.id) {
            resetResults();
            // Dịp gắn ngày là dịp CỦA một người — sang người khác phải chọn lại,
            // không thì sinh nhật của bà đi theo sang thiệp của ông.
            if (occasion?.date) setOccasion(null);
          }
          setMemberId(m.id);
        }}
      />
      <OccasionSheet
        visible={occasionSheet}
        onClose={() => setOccasionSheet(false)}
        items={dates.data?.items ?? []}
        memberId={target?.id ?? null}
        loading={familyId !== null && dates.isPending}
        error={dates.isError && !dates.data}
        onRetry={() => void dates.refetch()}
        onSelect={(choice) => {
          if (choice.label !== occasion?.label || choice.date !== occasion?.date) resetResults();
          setOccasion(choice);
        }}
      />

      {/* "Where this came from" — refs của biến thể, server lần về bài/ghi chú thật */}
      <Sheet
        visible={openSources !== null}
        onClose={() => setOpenSources(null)}
        title={t('ai.message.sourcesTitle')}
      >
        {sources.isPending && openSources !== null && (
          <View style={{ paddingVertical: 18, alignItems: 'center' }}>
            <ActivityIndicator color={colors.coral.primary} />
          </View>
        )}

        {sources.isError && (
          <InlineError
            message={t('ai.message.sourcesError')}
            onRetry={() => void sources.refetch()}
          />
        )}

        {resolvedSources.map((ref) => (
          <View key={ref.ref} style={{ gap: 8 }}>
            {!!ref.topic && (
              <Text variant="body2" weight="semibold">
                {ref.topic}
              </Text>
            )}
            {!!ref.text && (
              <Text variant="body2" color={colors.text.secondary}>
                {`“${ref.text}”`}
                {ref.author_name ? (
                  <Text variant="badge" color={colors.text.subtle}>
                    {'  '}
                    {t('ai.gifts.sourceBy', { name: ref.author_name })}
                  </Text>
                ) : null}
              </Text>
            )}
            {ref.post_id !== null && (
              <Button
                label={t('ai.gifts.openPost')}
                variant="neutral"
                size="small"
                onPress={() => {
                  const postId = ref.post_id!;
                  setOpenSources(null);
                  router.push(`/post/${postId}`);
                }}
              />
            )}
          </View>
        ))}

        {/* refs không lần ra gì (đã xoá / unknown) — sheet không được câm lặng */}
        {sources.data && resolvedSources.length === 0 && (
          <Text variant="body2" color={colors.text.body}>
            {t('ai.gifts.sourceGone')}
          </Text>
        )}
      </Sheet>
    </View>
  );
}

import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronDown, Copy, Gift, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { DateTile } from '../../src/components/ai/date-tile';
import { MemberSheet } from '../../src/components/ai/member-sheet';
import { OccasionSheet, type OccasionChoice } from '../../src/components/ai/occasion-sheet';
import { Pill } from '../../src/components/ai/pill';
import { SectionLabel } from '../../src/components/ai/section-label';
import { SelectRow } from '../../src/components/ai/select-row';
import { SourceChip } from '../../src/components/ai/source-chip';
import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Avatar } from '../../src/components/ui/avatar';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { IconBadge } from '../../src/components/ui/icon-badge';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useAiLocale } from '../../src/features/ai/use-ai-locale';
import { useMessageSuggestions } from '../../src/features/ai/use-gift-ideas';
import { useSpecialDates } from '../../src/features/ai/use-special-dates';
import { families } from '../../src/lib/api';
import type { MessageVariant } from '../../src/lib/api';
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

  const target = members.find((m) => m.id === memberId) ?? members[0] ?? null;
  const suggest = useMessageSuggestions(familyId, target?.id ?? null);
  const locale = useAiLocale();

  const occasionDays = occasion?.date
    ? ((dates.data?.items ?? []).find((i) => i.nextOccurrence === occasion.date)?.daysUntil ?? null)
    : null;

  const generate = (nextTone?: 'warm' | 'formal') => {
    const useTone = nextTone ?? tone;
    if (nextTone) setTone(nextTone);
    if (!occasion) return;
    // lời nhắn phải viết bằng ngôn ngữ người dùng đang dùng app.
    // force khi màn ĐÃ có kết quả: server giờ cache lời nhắn theo (người, dịp, tone)
    // — "Say it differently" cùng tone mà không force sẽ trả lại nguyên bản cũ.
    suggest.mutate({
      occasionLabel: occasion.label,
      extraNote: extraNote.trim() || undefined,
      tone: useTone,
      locale,
      force: suggest.data != null,
    });
  };

  const copy = (v: MessageVariant) => {
    void Clipboard.setStringAsync(v.text);
    setCopied(v.length);
    setTimeout(() => setCopied(null), 1600);
  };

  const toCard = () => {
    const variants = suggest.data?.variants ?? [];
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
        left={<BackButton onPress={() => router.back()} />}
        center={<ScreenTitle title={t('ai.message.title')} />}
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
        {/* To + Occasion — hai hàng trong MỘT card (11e) */}
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

        {/* ANYTHING TO ADD */}
        <TextField
          label={t('ai.message.anythingToAdd')}
          uppercaseLabel
          value={extraNote}
          onChangeText={setExtraNote}
          placeholder={t('ai.message.anythingPlaceholder')}
        />

        {!suggest.data && (
          <Button
            label={t('ai.message.generate')}
            variant="primary"
            size="large"
            fullWidth
            disabled={!familyId || !target || !occasion || suggest.isPending}
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

        {suggest.data && !suggest.isPending && (
          <>
            {/* "✦ Three ways to say it" */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Sparkles size={15} color={colors.coral.hover} strokeWidth={2.2} />
              <Text variant="body2" weight="bold">
                {t('ai.message.threeWays')}
              </Text>
            </View>

            {suggest.data.variants.map((v) => (
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
                    accessibilityRole="button"
                    accessibilityLabel={t('ai.message.copy')}
                    style={({ pressed }) => ({
                      width: 30,
                      height: 30,
                      borderRadius: radius.full,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colors.state.borderNeutral,
                      backgroundColor: pressed ? colors.background.subtle : colors.background.card,
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

                {v.memories_used.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {v.memories_used.map((id) => (
                      <SourceChip key={id} label={t('ai.message.fromShared')} />
                    ))}
                  </View>
                )}
              </Card>
            ))}

            {/* màn 25 — SAY IT DIFFERENTLY */}
            <SectionLabel label={t('ai.message.sayDifferently')} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pill
                label={t('ai.message.warmer')}
                selected={tone === 'warm'}
                onPress={() => generate('warm')}
              />
              <Pill
                label={t('ai.message.moreFormal')}
                selected={tone === 'formal'}
                onPress={() => generate('formal')}
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
      </ScrollView>

      <MemberSheet
        visible={memberSheet}
        onClose={() => setMemberSheet(false)}
        members={members}
        selectedId={target?.id ?? null}
        onSelect={(m) => setMemberId(m.id)}
      />
      <OccasionSheet
        visible={occasionSheet}
        onClose={() => setOccasionSheet(false)}
        items={dates.data?.items ?? []}
        memberId={target?.id ?? null}
        onSelect={setOccasion}
      />
    </View>
  );
}

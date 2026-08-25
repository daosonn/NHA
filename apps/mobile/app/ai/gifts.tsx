import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Gift } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BudgetSlider, budgetLabel } from '../../src/components/ai/budget-slider';
import { DateTile } from '../../src/components/ai/date-tile';
import { MemberSheet } from '../../src/components/ai/member-sheet';
import { OccasionSheet, type OccasionChoice } from '../../src/components/ai/occasion-sheet';
import { SectionLabel } from '../../src/components/ai/section-label';
import { SelectRow } from '../../src/components/ai/select-row';
import { AppHeader } from '../../src/components/layout/app-header';
import { contentColumn } from '../../src/components/layout/content-column';
import { BackButton, ScreenTitle } from '../../src/components/layout/header-slots';
import { Avatar } from '../../src/components/ui/avatar';
import { AvatarStack } from '../../src/components/ui/avatar-stack';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { IconBadge } from '../../src/components/ui/icon-badge';
import { Text } from '../../src/components/ui/text';
import { useSession } from '../../src/features/auth/session';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useEvidenceStats, useSavedGiftIdeas } from '../../src/features/ai/use-gift-ideas';
import { useMyProfile } from '../../src/features/member/use-profile';
import { useSpecialDates } from '../../src/features/ai/use-special-dates';
import { families, profiles } from '../../src/lib/api';
import { formatFullDate } from '../../src/lib/date';
import { queryKeys } from '../../src/lib/query-keys';
import { colors, spacing } from '../../src/theme';
import { goBack } from '../../src/lib/navigation';

/** Màn 21 (11a) — "Who, when, how much — nothing else". */

export default function GiftAskScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { familyId } = useActiveFamily();
  const { user } = useSession();
  // Ảnh của chính mình đọc từ hồ sơ: phiên đăng nhập chỉ giữ tên và email
  const myProfile = useMyProfile();
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
  const [budget, setBudget] = useState<[number, number]>([3000, 8000]);
  const [memberSheet, setMemberSheet] = useState(false);
  const [occasionSheet, setOccasionSheet] = useState(false);

  const target = members.find((m) => m.id === memberId) ?? members[0] ?? null;

  // "grandmother · born 30 Aug 1956" — birth date belongs to the member's profile
  const profile = useQuery({
    queryKey: queryKeys.memberProfile(familyId ?? 'none', target?.id ?? 'none'),
    queryFn: () => profiles.member(familyId as string, target!.id),
    enabled: familyId !== null && target !== null,
  });
  const born = profile.data?.birthDate ? formatFullDate(profile.data.birthDate.slice(0, 10)) : null;

  const stats = useEvidenceStats(familyId, target?.id ?? null);
  const saved = useSavedGiftIdeas(familyId, target?.id ?? null);

  const occasionDays = occasion?.date
    ? ((dates.data?.items ?? []).find((i) => i.nextOccurrence === occasion.date)?.daysUntil ?? null)
    : null;

  const sinceMonth = stats.data?.since
    ? t(`date.months.${Number(stats.data.since.slice(5, 7))}`)
    : null;

  const canAsk = !!familyId && !!target && !!occasion;

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => goBack()} />}
        center={<ScreenTitle title={t('ai.gifts.title')} />}
      />

      <ScrollView
        contentContainerStyle={{
          ...contentColumn,
          paddingTop: 14,
          paddingBottom: 40,
          gap: 8,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* FOR */}
        <SectionLabel label={t('ai.gifts.for')} />
        <SelectRow
          leading={<Avatar size={38} name={target?.displayName} mediaId={target?.avatarKey} />}
          title={target?.displayName ?? t('ai.gifts.pickPerson')}
          subtitle={born ? t('ai.gifts.bornOn', { date: born }) : (family.data?.name ?? null)}
          onPress={() => setMemberSheet(true)}
        />

        {/* OCCASION */}
        <View style={{ height: 6 }} />
        <SectionLabel label={t('ai.gifts.occasion')} />
        <SelectRow
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

        {/* BUDGET */}
        <View style={{ height: 6 }} />
        <SectionLabel
          label={t('ai.gifts.budget')}
          trailing={
            <Text variant="caption" weight="bold" color={colors.text.primary}>
              {budgetLabel(budget[0], budget[1])}
            </Text>
          }
        />
        <Card padding={14}>
          <BudgetSlider value={budget} onChange={setBudget} />
        </Card>

        {/* FROM */}
        <View style={{ height: 6 }} />
        <SectionLabel label={t('ai.gifts.from')} />
        <SelectRow
          leading={<Avatar size={38} name={user?.name} mediaId={myProfile.data?.avatarMediaId} />}
          title={user?.name ?? ''}
          subtitle={family.data?.name ?? null}
          trailing="lock"
        />

        <View style={{ height: 8 }} />
        <Button
          label={t('ai.gifts.suggest')}
          variant="primary"
          size="large"
          fullWidth
          disabled={!canAsk}
          onPress={() =>
            router.push({
              pathname: '/ai/gift-results',
              params: {
                memberId: target!.id,
                memberName: target!.displayName,
                occasion: occasion!.label,
                occasionDate: occasion!.date ?? '',
                budget: budgetLabel(budget[0], budget[1]),
              },
            })
          }
        />
        <View style={{ height: 4 }} />

        {/* "12 photos and 4 notes about her · shared since January" */}
        {stats.data && (stats.data.photos > 0 || stats.data.notes > 0) && (
          <SelectRow
            leading={
              <AvatarStack
                items={[{ id: 'a' }, { id: 'b', tone: 'dark' }, { id: 'c' }]}
                size={28}
                surface={colors.background.card}
              />
            }
            title={t('ai.gifts.evidenceCount', {
              photos: stats.data.photos,
              notes: stats.data.notes,
            })}
            subtitle={sinceMonth ? t('ai.gifts.sharedSince', { month: sinceMonth }) : null}
            trailing="none"
          />
        )}

        {/* "Two ideas you saved last year" */}
        {(saved.data?.length ?? 0) > 0 && (
          <SelectRow
            leading={
              <IconBadge
                size={38}
                background={colors.background.subtle}
                foreground={colors.text.muted}
                renderIcon={({ size, color }) => (
                  <Gift size={size} color={color} strokeWidth={2.1} />
                )}
              />
            }
            title={t('ai.gifts.savedBefore', { count: saved.data!.length })}
            subtitle={saved
              .data!.map((s) => s.title)
              .slice(0, 2)
              .join(' · ')}
            trailing="none"
          />
        )}

        <View style={{ height: 4 }} />
        <Text variant="badge" color={colors.text.subtle} style={{ textAlign: 'center' }}>
          {t('ai.privacyFooter')}
        </Text>
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

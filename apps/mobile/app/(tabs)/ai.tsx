import { useRouter } from 'expo-router';
import { Film, Gift, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { specialDateIcon, specialDateKindKey } from '../../src/components/ai/occasion-kind';
import { DateTile } from '../../src/components/ai/date-tile';
import { SelectRow } from '../../src/components/ai/select-row';
import { AppHeader } from '../../src/components/layout/app-header';
import { NotificationBell } from '../../src/components/layout/header-slots';
import { Avatar } from '../../src/components/ui/avatar';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Card } from '../../src/components/ui/card';
import { IconBadge } from '../../src/components/ui/icon-badge';
import { Text } from '../../src/components/ui/text';
import { useActiveFamily } from '../../src/features/family/active-family';
import { useOccasionLabel, useSpecialDates } from '../../src/features/ai/use-special-dates';
import type { SpecialDateItem } from '../../src/lib/api';
import { formatDayMonth } from '../../src/lib/date';
import { colors, radius, spacing } from '../../src/theme';

/** Clears the bottom nav (56pt plus the home indicator). */
const BOTTOM_INSET = 120;

/** Icon-tile colours of the MAKE SOMETHING rows — straight from the mockup. */
const MAKE_TILES = {
  gift: colors.coral.primary,
  message: colors.coral.hover,
  video: '#9C6F9F',
} as const;

function makeTile(bg: string, icon: (props: { size: number; color: string }) => React.ReactNode) {
  return (
    <View
      style={{
        width: 42,
        height: 42,
        borderRadius: radius.xl,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon({ size: 20, color: colors.text.white })}
    </View>
  );
}

/** Weekday of a plain `YYYY-MM-DD`, parsed by hand so the day never drifts. */
function weekdayIndex(isoDate: string): number | null {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getDay();
}

/**
 * The AI tab — the "Present" home of the mockups.
 *
 * "Coming up" opens on the dates the family actually keeps (special-dates
 * API), and every action chip leads straight into a maker flow with the
 * person and the occasion already filled in.
 */
export default function AiScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { familyId } = useActiveFamily();
  const dates = useSpecialDates(familyId);
  const occasionLabel = useOccasionLabel();
  const [showAll, setShowAll] = useState(false);

  const items = dates.data?.items ?? [];
  const thisMonth = items.filter((i) => i.daysUntil <= 31).length;
  const featured: SpecialDateItem | undefined = items[0];
  const rest = items.slice(1, showAll ? undefined : 3);

  const featuredMember = featured?.members[0] ?? null;
  const featuredOccasion = featured
    ? `${occasionLabel(featured)}${formatDayMonth(featured.nextOccurrence) ? ` · ${formatDayMonth(featured.nextOccurrence)}` : ''}`
    : null;

  /** "Sunday 30 Aug · in 11 days" */
  const featuredMeta = featured
    ? [
        weekdayIndex(featured.nextOccurrence) !== null
          ? t(`date.weekdays.${weekdayIndex(featured.nextOccurrence)}`)
          : null,
        formatDayMonth(featured.nextOccurrence),
      ]
        .filter(Boolean)
        .join(' ') + ` · ${t('ai.daysAway', { count: featured.daysUntil })}`
    : null;

  const pushMaker = (pathname: '/ai/gifts' | '/ai/message' | '/video/setup') =>
    router.push({
      pathname,
      params:
        featured && featuredMember
          ? {
              memberId: featuredMember.memberId,
              memberName: featuredMember.displayName,
              occasion: featuredOccasion ?? '',
              occasionDate: featured.nextOccurrence,
            }
          : {},
    });

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <BrandMark size={26} />
            <Text serif weight="bold" accessibilityRole="header" style={{ fontSize: 21, lineHeight: 26, letterSpacing: -0.2 }}>
              Present
            </Text>
          </View>
        }
        right={<NotificationBell count={thisMonth} />}
        paddingRight={spacing.lg}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: 14,
          paddingBottom: BOTTOM_INSET,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 6 }}>
          <Text
            serif
            weight="bold"
            accessibilityRole="header"
            style={{ fontSize: 27, lineHeight: 34, letterSpacing: -0.4 }}
          >
            {t('ai.hub.comingUp')}
          </Text>
          <Text variant="body2" color={colors.text.muted}>
            {t('ai.hub.datesThisMonth', { count: thisMonth })}
          </Text>
        </View>

        {/* ---------- featured: the next date that needs a decision ---------- */}
        {featured && featuredMember && (
          <View style={{ backgroundColor: colors.coral.light, borderRadius: radius['4xl'], padding: 15, gap: 13 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar size={46} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text variant="subtitle" weight="semibold" style={{ letterSpacing: -0.15 }} numberOfLines={1}>
                  {occasionLabel(featured)}
                </Text>
                <Text variant="caption" color={colors.text.muted} numberOfLines={1}>
                  {featuredMeta}
                </Text>
              </View>
              <IconBadge
                size={36}
                background={colors.coral.primary}
                foreground={colors.text.white}
                renderIcon={specialDateIcon(featured.type)}
              />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Button
                label={t('ai.giftIdeas')}
                size="small"
                onPress={() => pushMaker('/ai/gifts')}
                renderIcon={({ size, color }) => <Gift size={size} color={color} strokeWidth={2.1} />}
              />
              <Button
                label={t('ai.hub.message')}
                variant="neutral"
                size="small"
                onPress={() => pushMaker('/ai/message')}
                renderIcon={({ size, color }) => <Mail size={size} color={color} strokeWidth={2.1} />}
              />
              <Button
                label={t('ai.video')}
                variant="neutral"
                size="small"
                onPress={() => pushMaker('/video/setup')}
                renderIcon={({ size, color }) => <Film size={size} color={color} strokeWidth={2.1} />}
              />
            </View>
          </View>
        )}

        {/* ---------- ALSO THIS SEASON ---------- */}
        {rest.length > 0 && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text
                variant="badge"
                weight="semibold"
                color={colors.text.lightMuted}
                style={{ letterSpacing: 0.7, textTransform: 'uppercase' }}
              >
                {t('ai.hub.alsoThisSeason')}
              </Text>
              {items.length > 3 && (
                <Pressable onPress={() => setShowAll((v) => !v)} accessibilityRole="button" hitSlop={8}>
                  <Text variant="caption" weight="semibold" color={colors.coral.hover}>
                    {showAll ? t('common.close') : t('ai.hub.seeAll')}
                  </Text>
                </Pressable>
              )}
            </View>

            <Card padding={8} style={{ gap: 2 }}>
              {rest.map((item, index) => (
                <View
                  key={`${item.type}-${item.nextOccurrence}-${item.members[0]?.memberId ?? index}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    padding: 6,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.state.borderDefault,
                  }}
                >
                  <DateTile day={item.day} month={t(`date.months.${item.month}`)} />
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <Text variant="body2" weight="semibold" numberOfLines={1}>
                      {occasionLabel(item)}
                    </Text>
                    <Text variant="caption" color={colors.text.muted} numberOfLines={1}>
                      {t('ai.daysAway', { count: item.daysUntil })} · {t(specialDateKindKey(item.type))}
                    </Text>
                  </View>
                  <IconBadge
                    size={32}
                    background={colors.background.subtle}
                    foreground={colors.text.muted}
                    renderIcon={specialDateIcon(item.type)}
                  />
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* ---------- MAKE SOMETHING ---------- */}
        <View style={{ gap: 10 }}>
          <Text
            variant="badge"
            weight="semibold"
            color={colors.text.lightMuted}
            style={{ letterSpacing: 0.7, textTransform: 'uppercase' }}
          >
            {t('ai.hub.makeSomething')}
          </Text>

          <SelectRow
            leading={makeTile(MAKE_TILES.gift, (p) => (
              <Gift {...p} strokeWidth={2.1} />
            ))}
            title={t('ai.giftIdeas')}
            subtitle={t('ai.hub.giftIdeasDesc')}
            onPress={() => pushMaker('/ai/gifts')}
          />
          <SelectRow
            leading={makeTile(MAKE_TILES.message, (p) => (
              <Mail {...p} strokeWidth={2.1} />
            ))}
            title={t('ai.hub.messageCard')}
            subtitle={t('ai.hub.messageCardDesc')}
            onPress={() => pushMaker('/ai/message')}
          />
          <SelectRow
            leading={makeTile(MAKE_TILES.video, (p) => (
              <Film {...p} strokeWidth={2.1} />
            ))}
            title={t('ai.hub.memoryVideo')}
            subtitle={t('ai.hub.memoryVideoDesc')}
            onPress={() => pushMaker('/video/setup')}
          />
        </View>
      </ScrollView>
    </View>
  );
}

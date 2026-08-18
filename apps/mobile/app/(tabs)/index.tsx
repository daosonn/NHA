import { useRouter } from 'expo-router';
import { HousePlus, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { EventWidget } from '../../src/components/home/event-widget';
import { GroupStrip, type FamilyGroupSummary } from '../../src/components/home/group-strip';
import { MomentPeek, SwipeCue } from '../../src/components/home/moment-peek';
import { RecommendationGrid } from '../../src/components/home/recommendation-grid';
import { AppHeader } from '../../src/components/layout/app-header';
import { BrandWordmark, NotificationBell } from '../../src/components/layout/header-slots';
import { EmptyState } from '../../src/components/ui/empty-state';
import { SectionHeader } from '../../src/components/ui/section-header';
import { useFamilies } from '../../src/features/family/use-families';
import type { FamilySummary } from '../../src/lib/api';
import { notificationCount, recommendations, upcomingEvent } from '../../src/fixtures/home';
import { colors, spacing } from '../../src/theme';

/** Room for the bottom nav plus the moment sliver poking above it. */
const BOTTOM_INSET = 160;

/** How many faces the strip draws before it collapses the rest into "+N". */
const VISIBLE_GROUPS = 3;

/**
 * Alternating tones are decoration, not data: the avatars are placeholders
 * until members have photos, and two identical stripe patterns side by side
 * read as one wide blob.
 */
function toStripGroups(families: FamilySummary[]): FamilyGroupSummary[] {
  return families.slice(0, VISIBLE_GROUPS).map((family, index) => ({
    id: family.id,
    name: family.name,
    tone: index % 2 === 0 ? 'light' : 'dark',
  }));
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const { data: families, isPending, isError, refetch } = useFamilies();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.page }}>
      <AppHeader
        left={<BrandWordmark />}
        right={<NotificationBell count={notificationCount} />}
        paddingRight={spacing.lg}
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: BOTTOM_INSET,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        {renderBody({ families, isPending, isError, refetch, router, t })}
      </ScrollView>

      <MomentPeek />
    </View>
  );
}

type BodyProps = {
  families: FamilySummary[] | undefined;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
  router: ReturnType<typeof useRouter>;
  t: ReturnType<typeof useTranslation>['t'];
};

/**
 * Four states, flat rather than nested.
 *
 * A chain of ternaries in the JSX put the reason for each branch out of
 * reach of the branch itself; this way the comment explaining "blank, not a
 * spinner" sits where the decision is made.
 */
function renderBody({ families, isPending, isError, refetch, router, t }: BodyProps) {
  if (isError) {
    return (
      <EmptyState
        renderIcon={({ size, color }) => (
          <TriangleAlert size={size} color={color} strokeWidth={2} />
        )}
        title={t('home.loadFailed')}
        actionLabel={t('home.retry')}
        onActionPress={refetch}
      />
    );
  }

  // Deliberately blank rather than a spinner: the request is usually faster
  // than a spinner is readable, and a flash of one is worse than a beat of
  // nothing.
  if (isPending || families === undefined) return null;

  // An account with no family is an ordinary state, not an error —
  // registration does not force anyone to make one first.
  if (families.length === 0) {
    return (
      <EmptyState
        renderIcon={({ size, color }) => <HousePlus size={size} color={color} strokeWidth={2} />}
        title={t('home.noFamilyTitle')}
        description={t('home.noFamilyBody')}
        actionLabel={t('home.startFamily')}
        onActionPress={() => router.push('/create-family')}
      />
    );
  }

  return (
    <>
      <GroupStrip
        groups={toStripGroups(families)}
        remainingCount={Math.max(0, families.length - VISIBLE_GROUPS)}
        onPress={() => router.push('/family')}
        onAddPress={() => router.push('/create-family')}
      />

      {/* Everything below still reads fixtures: special dates and
          recommendations have no endpoint yet
          (`docs/00-shared/api-contract.md`). */}
      <EventWidget event={upcomingEvent} />

      <SectionHeader title={t('home.recommendations')} actionLabel={t('home.seeAll')} />

      <RecommendationGrid feature={recommendations.feature} secondary={recommendations.secondary} />

      <SwipeCue />
    </>
  );
}

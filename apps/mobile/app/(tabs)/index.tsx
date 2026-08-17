import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { EventWidget } from '../../src/components/home/event-widget';
import { GroupStrip } from '../../src/components/home/group-strip';
import { MomentPeek, SwipeCue } from '../../src/components/home/moment-peek';
import { RecommendationGrid } from '../../src/components/home/recommendation-grid';
import { AppHeader } from '../../src/components/layout/app-header';
import { BrandWordmark, NotificationBell } from '../../src/components/layout/header-slots';
import { SectionHeader } from '../../src/components/ui/section-header';
import {
  familyGroups,
  notificationCount,
  recommendations,
  remainingGroupCount,
  upcomingEvent,
} from '../../src/fixtures/home';
import { colors, spacing } from '../../src/theme';

/** Room for the bottom nav plus the moment sliver poking above it. */
const BOTTOM_INSET = 160;

export default function HomeScreen() {
  const router = useRouter();

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
        <GroupStrip
          groups={familyGroups}
          remainingCount={remainingGroupCount}
          onPress={() => router.push('/family')}
        />

        <EventWidget event={upcomingEvent} />

        <SectionHeader title="Recommendations" actionLabel="See all" />

        <RecommendationGrid
          feature={recommendations.feature}
          secondary={recommendations.secondary}
        />

        <SwipeCue />
      </ScrollView>

      <MomentPeek />
    </View>
  );
}

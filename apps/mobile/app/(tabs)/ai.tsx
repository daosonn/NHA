import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { FeaturedOccasion } from '../../src/components/ai/featured-occasion';
import { OccasionRow } from '../../src/components/ai/occasion-row';
import { AppHeader } from '../../src/components/layout/app-header';
import { Text } from '../../src/components/ui/text';
import { featuredOccasion, occasionCount, upcomingOccasions } from '../../src/fixtures/ai';
import { colors, radius, spacing } from '../../src/theme';

/** Clears the bottom nav (56pt plus the home indicator). */
const BOTTOM_INSET = 120;

/** The rail that turns a list of dates into a year. */
function Spine({ last }: { last: boolean }) {
  return (
    <View style={{ width: 12, flexShrink: 0, alignItems: 'center', paddingTop: 20 }}>
      <View
        style={{
          width: 9,
          height: 9,
          borderRadius: radius.full,
          backgroundColor: colors.background.card,
          boxShadow: `inset 0 0 0 2.5px ${colors.state.borderDashed}`,
        }}
      />
      {!last && <View style={{ flex: 1, width: 2, marginTop: 4, backgroundColor: '#EFEAE6' }} />}
    </View>
  );
}

/**
 * The AI tab.
 *
 * It opens on the calendar rather than on a prompt: the useful thing the app
 * knows is which dates the family keeps, and an idea is only worth anything
 * while there is still time to act on it.
 */
export default function AiScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {t('ai.title')}
          </Text>
        }
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
            {t('ai.heading')}
          </Text>

          <Text variant="body2" color={colors.text.muted}>
            {t('ai.subheading')}
          </Text>
        </View>

        <FeaturedOccasion occasion={featuredOccasion} onGifts={() => router.push('/ai/gifts')} />

        <View style={{ gap: 10 }}>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text
              variant="badge"
              weight="semibold"
              color={colors.text.lightMuted}
              style={{ letterSpacing: 0.7, textTransform: 'uppercase' }}
            >
              {t('ai.laterThisYear')}
            </Text>

            <Text variant="badge" color={colors.text.subtle}>
              {t('ai.dateCount', { count: occasionCount })}
            </Text>
          </View>

          <View>
            {upcomingOccasions.map((occasion, index) => (
              <View key={occasion.id} style={{ flexDirection: 'row', gap: 12 }}>
                <Spine last={index === upcomingOccasions.length - 1} />
                <View style={{ flex: 1, minWidth: 0, paddingBottom: 10 }}>
                  <OccasionRow occasion={occasion} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

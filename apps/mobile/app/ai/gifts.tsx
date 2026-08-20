import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { GiftCard } from '../../src/components/ai/gift-card';
import { AppHeader } from '../../src/components/layout/app-header';
import { BackButton } from '../../src/components/layout/header-slots';
import { Avatar } from '../../src/components/ui/avatar';
import { Text } from '../../src/components/ui/text';
import { giftEvidence, giftIdeas, giftPeople, type GiftPerson } from '../../src/fixtures/ai';
import { colors, radius, spacing } from '../../src/theme';

type PersonChipProps = {
  person: GiftPerson;
  selected: boolean;
  onPress: () => void;
};

/** Whose gift we are thinking about. Only one at a time — ideas are personal. */
function PersonChip({ person, selected, onPress }: PersonChipProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={t('ai.gifts.forPerson', { name: person.name })}
      style={{
        height: 38,
        paddingLeft: 6,
        paddingRight: 14,
        borderRadius: radius.full,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: selected ? colors.text.primary : colors.background.card,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.state.borderNeutral,
      }}
    >
      <Avatar size={26} name={person.name} />

      <Text
        variant="caption"
        weight="semibold"
        color={selected ? colors.text.white : colors.text.primary}
      >
        {person.name}
      </Text>
    </Pressable>
  );
}

/**
 * Gift ideas, grounded in what the family already wrote down.
 *
 * The evidence line comes before the suggestions on purpose: how much was
 * read is the difference between advice and a horoscope, and the reader
 * deserves to know it before the first idea, not after.
 */
export default function GiftIdeasScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [person, setPerson] = useState(giftPeople[0]?.id ?? '');
  const [saved, setSaved] = useState<string[]>([]);

  const toggleSave = (id: string) =>
    setSaved((current) =>
      current.includes(id) ? current.filter((each) => each !== id) : [...current, id],
    );

  return (
    <View className="flex-1 bg-page">
      <AppHeader
        left={<BackButton onPress={() => router.back()} />}
        center={
          <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
            {t('ai.gifts.title')}
          </Text>
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: 14,
          paddingBottom: 40,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {giftPeople.map((each) => (
            <PersonChip
              key={each.id}
              person={each}
              selected={each.id === person}
              onPress={() => setPerson(each.id)}
            />
          ))}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 11,
            paddingHorizontal: 14,
            borderRadius: radius.lg,
            backgroundColor: colors.background.subtle,
          }}
        >
          <Check size={15} color={colors.text.muted} strokeWidth={2.2} />

          <Text variant="caption" color={colors.text.body} style={{ flex: 1 }}>
            {t('ai.gifts.evidence', giftEvidence)}
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          {giftIdeas.map((idea) => (
            <GiftCard
              key={idea.id}
              idea={idea}
              saved={saved.includes(idea.id)}
              onToggleSave={() => toggleSave(idea.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

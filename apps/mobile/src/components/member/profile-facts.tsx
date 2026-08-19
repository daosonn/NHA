import { CalendarDays, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { MemberProfile } from '../../features/member/member-profile';
import { formatFullDate } from '../../lib/date';
import { colors, radius } from '../../theme';
import { Text } from '../ui/text';

function FactRow({
  renderIcon,
  children,
}: {
  renderIcon: (props: { size: number; color: string }) => React.ReactNode;
  children: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.sm,
          borderWidth: 1.4,
          borderColor: colors.coral.borderSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {renderIcon({ size: 12, color: colors.coral.dark })}
      </View>

      <Text variant="body2" color={colors.text.secondary} style={{ flex: 1, paddingTop: 1 }}>
        {children}
      </Text>
    </View>
  );
}

export type ProfileFactsProps = {
  profile: MemberProfile;
};

/**
 * The short facts about a person, in the coral block from mockup 7.
 *
 * The mockup draws three rows. Two of them are here:
 *
 * - **Born** — `LifeProfile.birthDate`, with `deathDate` folded into the same
 *   line when there is one. The mockup also names a birthplace ("Y Yen, Nam
 *   Dinh"); there is no column for it, so it is not invented.
 * - **Interests** — `LifeProfile.interests`, run together with separators the
 *   way the mockup reads them, rather than as chips. Chips are for choosing
 *   between things; these are being read.
 *
 * The third row, occupation ("Carpenter, retired since 2021"), has no field
 * behind it anywhere in the schema and is therefore not drawn. Both gaps are
 * backend work to schedule, not something the client can fill in.
 *
 * Renders nothing when it knows nothing. An empty coral box is worse than no
 * box: it reads as a section that failed to load.
 */
export function ProfileFacts({ profile }: ProfileFactsProps) {
  const { t } = useTranslation();

  const born = profile.birthDate === null ? null : formatFullDate(profile.birthDate);
  const died = profile.deathDate === null ? null : formatFullDate(profile.deathDate);

  const life =
    born === null
      ? null
      : died === null
        ? t('member.facts.born', { date: born })
        : t('member.facts.lifespan', { born, died });

  const interests = profile.interests.length === 0 ? null : profile.interests.join(' · ');

  if (life === null && interests === null) return null;

  return (
    <View
      style={{
        borderRadius: radius.xl,
        backgroundColor: colors.coral.light,
        padding: 14,
        gap: 10,
      }}
    >
      {life !== null && (
        <FactRow renderIcon={(props) => <CalendarDays {...props} strokeWidth={2.2} />}>
          {life}
        </FactRow>
      )}

      {interests !== null && (
        <FactRow renderIcon={(props) => <Sparkles {...props} strokeWidth={2.2} />}>
          {interests}
        </FactRow>
      )}
    </View>
  );
}

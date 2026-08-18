import type { TFunction } from 'i18next';
import { PencilLine } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { colors, radius } from '../../theme';
import type { MemberProfile } from '../../fixtures/member';
import { Avatar } from '../ui/avatar';
import { Chip } from '../ui/chip';
import { Text } from '../ui/text';

const AVATAR = 88;
/** Same warm-white lift the tree nodes use, so a face reads the same anywhere. */
const RING = `0 0 0 4px ${colors.background.card}, 0 0 0 5px ${colors.state.borderDefault}`;

const EDIT = 34;
/** The gap is painted, not empty: the badge sits on top of the avatar ring. */
const EDIT_RING = `0 0 0 2.5px ${colors.background.page}`;

/** Years only. A life is placed by its decades, not by exact days. */
function lifespan(t: TFunction, birthDate: string | null, deathDate: string | null): string | null {
  const born = birthDate?.slice(0, 4);
  const died = deathDate?.slice(0, 4);

  if (born !== undefined && died !== undefined) return t('member.lifespan', { born, died });
  if (born !== undefined) return t('member.bornYear', { year: born });
  return null;
}

export type ProfileHeroProps = {
  profile: MemberProfile;
  onEdit?: () => void;
};

/**
 * The identity block at the top of a Life Profile.
 *
 * Editing is a badge on the avatar rather than a button under the bio: it
 * belongs to the face it changes, and it keeps the space between the name
 * and the tabs empty, which is what makes the screen read as a person
 * rather than as a toolbar.
 *
 * Who may edit is a domain rule, not a UI preference: the viewer's own
 * profile is theirs alone, a placeholder is wiki-editable by the whole
 * family, and a linked account belongs to that person — see
 * docs/00-shared/domain-model.md.
 */
export function ProfileHero({ profile, onEdit }: ProfileHeroProps) {
  const { t } = useTranslation();

  const years = lifespan(t, profile.birthDate, profile.deathDate);
  const meta = [profile.relation, years].filter((part) => part !== null).join(' · ');
  const canEdit = profile.editability !== 'locked';

  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View>
        <Avatar size={AVATAR} tone={profile.tone} ring={RING} />

        {canEdit && (
          <Pressable
            onPress={onEdit}
            accessibilityRole="button"
            accessibilityLabel={
              profile.editability === 'self'
                ? t('member.editSelf')
                : t('member.addDetails', { name: profile.displayName })
            }
            hitSlop={6}
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: EDIT,
              height: EDIT,
              borderRadius: radius.full,
              backgroundColor: colors.coral.primary,
              boxShadow: EDIT_RING,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PencilLine size={16} color={colors.background.card} strokeWidth={2.2} />
          </Pressable>
        )}
      </View>

      <View style={{ alignItems: 'center', gap: 3 }}>
        <Text variant="h1" weight="bold" style={{ letterSpacing: -0.4 }}>
          {profile.displayName}
        </Text>

        <Text variant="caption" weight="medium" color={colors.text.muted}>
          {meta}
        </Text>
      </View>

      {profile.bio !== null ? (
        <Text variant="body2" color={colors.text.body} style={{ textAlign: 'center' }}>
          {profile.bio}
        </Text>
      ) : (
        profile.editability === 'wiki' && (
          <Text variant="body2" color={colors.text.subtle} style={{ textAlign: 'center' }}>
            {t('member.noBio')}
          </Text>
        )
      )}

      {profile.interests.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
          {profile.interests.map((interest) => (
            <Chip key={interest} label={interest} />
          ))}
        </View>
      )}
    </View>
  );
}

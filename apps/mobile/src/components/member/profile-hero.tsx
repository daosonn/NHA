import { PencilLine } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { MemberProfile } from '../../features/member/member-profile';
import { colors, radius } from '../../theme';
import { Avatar } from '../ui/avatar';
import { Card } from '../ui/card';
import { Text } from '../ui/text';

const AVATAR = 56;
/** Same warm-white lift the tree nodes use, so a face reads the same anywhere. */
const RING = `0 0 0 3px ${colors.background.card}, 0 0 0 4px ${colors.state.borderDefault}`;

const EDIT = 30;

export type ProfileHeroProps = {
  profile: MemberProfile;
  onEdit?: () => void;
};

/**
 * The identity block at the top of a Life Profile (mockup 7).
 *
 * A card with the face on the left rather than a centred column: the screen
 * below it is a stack of cards, and centring the one at the top made it read
 * as a banner the rest of the page hung off. Left-aligned it is the first row
 * of the page, which is what it is.
 *
 * The bio lives here rather than in the facts block under it. The mockup does
 * not draw one at all — its example person has none — but the field is real,
 * the edit screen writes it, and dropping it from the only screen that shows
 * it would quietly lose what somebody wrote about their own life. A paragraph
 * belongs with the name, not in a list of one-line facts.
 *
 * Who may edit is the server's answer, carried on `editability`.
 */
export function ProfileHero({ profile, onEdit }: ProfileHeroProps) {
  const { t } = useTranslation();

  const meta = [profile.relation, profile.familyName]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');

  return (
    <Card padding={16} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
      <Avatar size={AVATAR} name={profile.displayName} tone={profile.tone} ring={RING} />

      <View style={{ flex: 1, gap: 3, paddingTop: 2 }}>
        <Text variant="h2" weight="bold" style={{ letterSpacing: -0.3 }}>
          {profile.displayName}
        </Text>

        {meta !== '' && (
          <Text variant="caption" weight="medium" color={colors.coral.deep}>
            {meta}
          </Text>
        )}

        {profile.bio !== null && profile.bio !== '' ? (
          <Text variant="body2" color={colors.text.body} style={{ paddingTop: 4 }}>
            {profile.bio}
          </Text>
        ) : (
          // Only on your own profile. On somebody else's, an empty story is
          // not a gap the reader can close — saying so would only point at a
          // door that is not theirs to open.
          profile.editability === 'self' && (
            <Text variant="body2" color={colors.text.subtle} style={{ paddingTop: 4 }}>
              {t('member.noBio')}
            </Text>
          )
        )}
      </View>

      {profile.editability === 'self' && (
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={t('member.editSelf')}
          hitSlop={8}
          style={{
            width: EDIT,
            height: EDIT,
            borderRadius: radius.full,
            backgroundColor: colors.coral.light,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PencilLine size={15} color={colors.coral.deep} strokeWidth={2.2} />
        </Pressable>
      )}
    </Card>
  );
}

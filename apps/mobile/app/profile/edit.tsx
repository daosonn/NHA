import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { FormScreen } from '../../src/components/layout/form-screen';
import { useToast } from '../../src/components/ui/toast';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import {
  useMemberProfile,
  useMyProfile,
  useUpdateMemberProfile,
  useUpdateMyProfile,
} from '../../src/features/member/use-profile';
import { ApiError, type ProfileDetail } from '../../src/lib/api';
import { dayOnly, formatFullDate } from '../../src/lib/date';
import { colors, radius } from '../../src/theme';
import { goBack } from '../../src/lib/navigation';

const MAX_BIO = 5000;
const MAX_INTERESTS = 50;

/** `YYYY-MM-DD`, which is what the API stores and `src/lib/date.ts` reads. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A date the server will accept, or a reason it will not.
 *
 * Checked here as well as on the server because a 400 arriving after a save
 * cannot say *which* field was wrong, and a person who typed 31 February
 * deserves to be told before they press the button.
 */
function dateError(value: string): 'format' | 'real' | null {
  if (value.trim() === '') return null;
  if (!ISO_DATE.test(value.trim())) return 'format';

  const [year, month, day] = value.trim().split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return 'format';

  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  return real ? null : 'real';
}

/**
 * Order counts: the chips keep the order they were added in, and the server
 * stores the array as given, so a reordered list is a real edit.
 */
function sameInterests(next: string[], original: string[]): boolean {
  return next.length === original.length && next.every((item, i) => item === original[i]);
}

/**
 * `null` clears the date on the server; `undefined` leaves it alone.
 *
 * The original is cut to its calendar day before the comparison, because it
 * arrives as a full timestamp. Without that, an untouched field looks edited
 * on every save — `'1964-03-14' !== '1964-03-14T00:00:00.000Z'` — and the
 * date is rewritten for no reason each time.
 */
function toPatchDate(value: string, original: string | null): string | null | undefined {
  const next = value.trim() === '' ? null : value.trim();
  const before = original === null ? null : dayOnly(original);
  return next === before ? undefined : next;
}

function InterestChips({
  interests,
  onRemove,
}: {
  interests: string[];
  onRemove: (interest: string) => void;
}) {
  const { t } = useTranslation();

  if (interests.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {interests.map((interest) => (
        <View
          key={interest}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 30,
            paddingLeft: 12,
            paddingRight: 6,
            borderRadius: radius.full,
            backgroundColor: colors.background.subtle,
          }}
        >
          <Text variant="caption" weight="medium" color={colors.text.secondary}>
            {interest}
          </Text>

          <Pressable
            onPress={() => onRemove(interest)}
            accessibilityRole="button"
            accessibilityLabel={t('profileEdit.removeInterest', { interest })}
            hitSlop={8}
            style={{
              width: 18,
              height: 18,
              borderRadius: radius.full,
              backgroundColor: colors.background.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={11} color={colors.text.muted} strokeWidth={2.6} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

/**
 * The one screen that writes a Life Profile.
 *
 * Reached from the pencil badge on the avatar. The params decide which route
 * reads it: none means `/me/profile`, a family and member id means the same
 * person seen through their node in the tree.
 *
 * Only ever your own: the pencil that opens it is drawn on your profile and
 * nowhere else (decided 2026-08-19, see `features/member/member-profile.ts`).
 * The member route is still here because your own node in the tree reaches
 * you that way. That is also why the screen speaks in the second person and
 * why there is no death-date field — see below.
 *
 * It does not edit your name. `displayName` comes back from the server but is
 * not part of `UpdateProfileDto`: it is `User.name`, which has no endpoint
 * yet.
 */
export default function ProfileEditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { familyId, memberId } = useLocalSearchParams<{
    familyId?: string;
    memberId?: string;
  }>();

  const ownProfile = familyId === undefined || memberId === undefined;

  const mine = useMyProfile();
  const theirs = useMemberProfile(ownProfile ? null : familyId, ownProfile ? null : memberId);
  const query = ownProfile ? mine : theirs;

  const updateMine = useUpdateMyProfile();
  const updateTheirs = useUpdateMemberProfile(
    ownProfile ? null : familyId,
    ownProfile ? null : memberId,
  );
  const mutation = ownProfile ? updateMine : updateTheirs;

  if (query.isPending) {
    return (
      <FormScreen title={t('profileEdit.title')} onClose={() => goBack(router)}>
        <View style={{ paddingTop: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.coral.primary} />
        </View>
      </FormScreen>
    );
  }

  if (query.isError || query.data === undefined) {
    return (
      <FormScreen title={t('profileEdit.title')} onClose={() => goBack(router)}>
        <View style={{ paddingTop: 24, gap: 12 }}>
          <Text variant="body1" color={colors.text.muted}>
            {t('profileEdit.loadFailed')}
          </Text>
          <Button
            label={t('home.retry')}
            variant="secondary"
            onPress={() => void query.refetch()}
          />
        </View>
      </FormScreen>
    );
  }

  return (
    <ProfileEditForm
      detail={query.data}
      saving={mutation.isPending}
      error={mutation.error}
      onSave={(input) => {
        mutation.mutate(input, {
          onSuccess: () => {
            goBack(router);
            toast.success(t('profileEdit.toast.saved'));
          },
        });
      }}
      onCancel={() => goBack(router)}
    />
  );
}

/**
 * No `deathDate`. It is optional in `UpdateProfileDto`, and omitting a key
 * leaves the column alone — which is the point: this screen must never send
 * it, or opening it on a profile that has one and pressing Save would clear
 * it. See the form below for why the field is gone.
 */
type SaveInput = {
  bio?: string;
  interests?: string[];
  birthDate?: string | null;
};

/**
 * Split out so the fields can be seeded from the loaded profile with
 * `useState` — a form whose initial values arrive after the first render
 * either needs this or an effect that fights the person typing.
 */
function ProfileEditForm({
  detail,
  saving,
  error,
  onSave,
  onCancel,
}: {
  detail: ProfileDetail;
  saving: boolean;
  error: unknown;
  onSave: (input: SaveInput) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  const [bio, setBio] = useState(detail.bio ?? '');
  // `dayOnly`, not the raw value: the column is a DATE but it crosses the
  // wire as a full timestamp — `1964-03-14T00:00:00.000Z`. Seeding the field
  // with that made the editor open on its own "must be YYYY-MM-DD" error with
  // Save greyed out, and the only way out was to delete eleven characters by
  // hand. The rule is the same one `src/lib/date.ts` follows for display.
  const [birthDate, setBirthDate] = useState(
    detail.birthDate === null ? '' : dayOnly(detail.birthDate),
  );
  const [interests, setInterests] = useState<string[]>(detail.interests);
  const [draftInterest, setDraftInterest] = useState('');

  const birthProblem = dateError(birthDate);

  /** Never edited here, but a birth date cannot be moved past it. */
  const recordedDeath = detail.deathDate === null ? null : dayOnly(detail.deathDate);

  const ordered =
    birthProblem === null &&
    birthDate.trim() !== '' &&
    recordedDeath !== null &&
    recordedDeath < birthDate.trim();

  const canSave = birthProblem === null && !ordered;

  const addInterest = () => {
    const next = draftInterest.trim();
    if (next === '' || interests.length >= MAX_INTERESTS || interests.includes(next)) return;

    setInterests((current) => [...current, next]);
    setDraftInterest('');
  };

  const save = () => {
    if (!canSave) return;

    onSave({
      // '' clears the bio on the server, so an emptied field must still be sent.
      bio: bio === (detail.bio ?? '') ? undefined : bio,
      interests: sameInterests(interests, detail.interests) ? undefined : interests,
      birthDate: toPatchDate(birthDate, detail.birthDate),
    });
  };

  const errorKey =
    error === null || error === undefined
      ? null
      : error instanceof ApiError && error.isOffline
        ? 'errors.offline'
        : error instanceof ApiError && error.status === 403
          ? 'profileEdit.errors.forbidden'
          : 'errors.generic';

  return (
    <FormScreen
      title={t('profileEdit.title')}
      onClose={onCancel}
      footer={
        <>
          {errorKey !== null && (
            <Text
              variant="caption"
              color={colors.themes.destructive.text}
              accessibilityRole="alert"
            >
              {t(errorKey)}
            </Text>
          )}

          <Button
            label={t('profileEdit.save')}
            size="large"
            fullWidth
            disabled={!canSave}
            loading={saving}
            onPress={save}
          />
        </>
      }
    >
      <View style={{ gap: 6 }}>
        <Text variant="caption" weight="semibold" color={colors.text.secondary}>
          {t('profileEdit.nameLabel')}
        </Text>
        <Text variant="body1" weight="medium">
          {detail.displayName}
        </Text>
        <Text variant="badge" color={colors.text.subtle}>
          {t('profileEdit.nameFromAccount')}
        </Text>
      </View>

      <TextField
        label={t('profileEdit.bioLabel')}
        value={bio}
        onChangeText={setBio}
        placeholder={t('profileEdit.bioPlaceholder')}
        maxLength={MAX_BIO}
        multiline
        numberOfLines={6}
      />

      <View style={{ gap: 8 }}>
        <Text variant="caption" weight="semibold" color={colors.text.secondary}>
          {t('profileEdit.interestsLabel')}
        </Text>

        <InterestChips
          interests={interests}
          onRemove={(interest) =>
            setInterests((current) => current.filter((item) => item !== interest))
          }
        />

        {/* `center`, not `flex-end`: the field is 56 tall since the floating
            label moved inside it, and a bottom-hung 44 button read as sunk. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextField
              label={t('profileEdit.addInterestLabel')}
              value={draftInterest}
              onChangeText={setDraftInterest}
              placeholder={t('profileEdit.addInterestPlaceholder')}
              maxLength={100}
              onSubmitEditing={addInterest}
              returnKeyType="done"
            />
          </View>

          <Button
            label={t('profileEdit.addInterest')}
            variant="secondary"
            size="medium"
            disabled={draftInterest.trim() === ''}
            onPress={addInterest}
            renderIcon={({ size, color }) => <Plus size={size} color={color} strokeWidth={2.1} />}
          />
        </View>
      </View>

      <TextField
        label={t('profileEdit.birthLabel')}
        value={birthDate}
        onChangeText={setBirthDate}
        placeholder={t('profileEdit.datePlaceholder')}
        hint={t('profileEdit.dateHint')}
        error={
          birthProblem !== null
            ? t(
                birthProblem === 'format'
                  ? 'profileEdit.errors.date'
                  : 'profileEdit.errors.noSuchDay',
              )
            : // The complaint belongs on the field that can still be changed.
              // It used to sit under the death date, which is no longer here —
              // leaving it out would have made Save go grey with no reason
              // given anywhere on the screen.
              ordered
              ? t('profileEdit.errors.birthAfterDeath')
              : undefined
        }
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
      />

      {/* No death-date field.
 
          This screen only ever edits **you** — the pencil that opens it is
          drawn on your own profile and nowhere else — and asking somebody to
          fill in the day they died is not a form field, it is a tasteless
          question. Nobody was ever going to type into it.
 
          Recording a death belongs with the rest of what a family writes
          about someone else, which today is the family screen, not here. The
          column is untouched either way: `deathDate` is simply left out of
          the PATCH, and omitted means unchanged.
 
          Shown read-only when there is one, so a value that exists is never
          invisible — and so it is obvious this is not where it is changed. */}
      {recordedDeath !== null && (
        <View style={{ gap: 4 }}>
          <Text variant="caption" weight="semibold" color={colors.text.secondary}>
            {t('profileEdit.deathLabel')}
          </Text>
          <Text variant="body1" weight="medium">
            {formatFullDate(recordedDeath) ?? recordedDeath}
          </Text>
          <Text variant="badge" color={colors.text.subtle}>
            {t('profileEdit.deathReadOnly')}
          </Text>
        </View>
      )}
    </FormScreen>
  );
}

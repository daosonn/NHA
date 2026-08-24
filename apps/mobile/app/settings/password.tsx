import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '../../src/components/layout/form-screen';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useToast } from '../../src/components/ui/toast';
import { useSession } from '../../src/features/auth/session';
import { useChangePassword } from '../../src/features/auth/use-change-password';
import { useMyProfile } from '../../src/features/member/use-profile';
import { ApiError } from '../../src/lib/api';
import { colors } from '../../src/theme';

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72;

/**
 * WBS 3.4.3 — change the password from inside the app.
 *
 * Three fields rather than two: the current password is required even though
 * the request is already authenticated, because an unlocked phone left on a
 * table should not be enough to lock its owner out. The server enforces this;
 * the field is here because the server would refuse without it.
 *
 * It lands back on Settings rather than signing anybody out. Every *other*
 * device is signed out — that is the server's doing and the point of the
 * feature — but this one keeps working, on the fresh pair the response
 * carries (`features/auth/use-change-password.ts`).
 *
 * A **social-only** account (`hasPassword: false` on `GET /me/profile`) has
 * no current password to type, so it gets a different screen entirely: an
 * explanation and a way into `/settings/set-password`, which is the emailed
 * six-digit-code reset flow worn as "set a password" — the deliberate path
 * for these accounts (`api-contract.md` → Auth). Rendering the form and
 * letting it 400 would be a dead control.
 */
export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { user } = useSession();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const change = useChangePassword();
  const profile = useMyProfile();

  // Social-only account: offer "set a password" instead of the form. An
  // errored or still-loading profile falls through to the form — the server
  // enforces the real rule either way, this branch is only the better door.
  // Nothing is sent from here: the code goes out on the next screen, after
  // the password is chosen, so it arrives when there is something for it
  // to confirm.
  if (profile.data?.hasPassword === false) {
    return (
      <FormScreen
        onBack={() => router.back()}
        title={t('settings.password.set.title')}
        footer={
          <Button
            label={t('auth.verify.continue')}
            size="large"
            fullWidth
            disabled={user?.email == null}
            onPress={() => router.push('/settings/set-password')}
          />
        }
      >
        <Text variant="body2" color={colors.text.muted}>
          {t('settings.password.set.explain')}
        </Text>

        <Text variant="caption" color={colors.text.subtle}>
          {t('settings.password.set.howItWorks')}
        </Text>
      </FormScreen>
    );
  }

  const tooShort = next.length > 0 && next.length < MIN_PASSWORD;
  // Only complain once there is enough typed for it to be a real mismatch.
  const mismatched = confirmation.length >= next.length && confirmation !== next;
  const unchanged = next.length > 0 && next === current;

  const ready =
    current.length > 0 &&
    next.length >= MIN_PASSWORD &&
    next.length <= MAX_PASSWORD &&
    confirmation === next &&
    !unchanged;

  const submit = () => {
    if (!ready) return;

    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          toast.success(t('settings.password.changed'));
          router.back();
        },
      },
    );
  };

  /**
   * A 400 here is almost always the **current** password.
   *
   * The fields already bound the new one to 8–72 characters and refuse an
   * unchanged value before submitting, so of the server's three rejections
   * only "current password is incorrect" can normally reach the screen. The
   * third — an account that signs in with Google and has no password at all
   * — cannot be told apart from the wire, so the message names both rather
   * than asserting the likelier one.
   */
  const errorKey =
    change.error instanceof ApiError && change.error.status === 400
      ? 'settings.password.errors.rejected'
      : change.error !== null
        ? 'errors.generic'
        : null;

  return (
    <FormScreen
      onBack={() => router.back()}
      title={t('settings.password.title')}
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
            label={t('settings.password.submit')}
            size="large"
            fullWidth
            disabled={!ready}
            loading={change.isPending}
            onPress={submit}
          />
        </>
      }
    >
      <Text variant="body2" color={colors.text.muted}>
        {t('settings.password.subtitle')}
      </Text>

      <View style={{ gap: 15 }}>
        <TextField
          label={t('settings.password.current')}
          value={current}
          onChangeText={setCurrent}
          secure
          autoComplete="current-password"
          textContentType="password"
          renderIcon={({ size, color }) => <Lock size={size} color={color} strokeWidth={2} />}
        />

        <TextField
          label={t('settings.password.new')}
          value={next}
          onChangeText={setNext}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          maxLength={MAX_PASSWORD}
          hint={t('auth.fields.minCharacters', { count: MIN_PASSWORD })}
          error={
            tooShort
              ? t('auth.fields.minCharacters', { count: MIN_PASSWORD })
              : unchanged
                ? t('settings.password.errors.same')
                : undefined
          }
          renderIcon={({ size, color }) => <Lock size={size} color={color} strokeWidth={2} />}
        />

        <TextField
          label={t('settings.password.confirm')}
          value={confirmation}
          onChangeText={setConfirmation}
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          maxLength={MAX_PASSWORD}
          error={confirmation.length > 0 && mismatched ? t('auth.reset.mismatch') : undefined}
          renderIcon={({ size, color }) => <Lock size={size} color={color} strokeWidth={2} />}
        />
      </View>

      {/* Said before it happens, not after. Somebody with the app open on a
          tablet should know that tapping this ends that session. */}
      <Text variant="caption" color={colors.text.subtle}>
        {t('settings.password.signsOutOthers')}
      </Text>
    </FormScreen>
  );
}

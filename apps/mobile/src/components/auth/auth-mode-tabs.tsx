import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SegmentedTabs } from '../ui/segmented-tabs';

export type AuthMode = 'sign-in' | 'sign-up';

/**
 * Sign in and Create account as two halves of one control.
 *
 * They are one decision, not two destinations, so switching between them is
 * a `replace` — going back from Create account should leave the flow, not
 * walk backwards through every time the person changed their mind.
 */
export function AuthModeTabs({ mode }: { mode: AuthMode }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <SegmentedTabs
      accessibilityLabel={t('auth.modeLabel')}
      value={mode}
      onChange={(next) => router.replace(next === 'sign-in' ? '/sign-in' : '/sign-up')}
      options={[
        { value: 'sign-in', label: t('auth.signInTab') },
        { value: 'sign-up', label: t('auth.signUpTab') },
      ]}
    />
  );
}

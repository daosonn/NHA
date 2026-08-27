import { useRouter } from 'expo-router';
import { safeBack } from '../src/lib/back';
import { Hash } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '../src/components/layout/form-screen';
import { Button } from '../src/components/ui/button';
import { Text } from '../src/components/ui/text';
import { TextField } from '../src/components/ui/text-field';
import { TextLink } from '../src/components/ui/text-link';
import { useJoinFamily } from '../src/features/family/use-family-mutations';
import { ApiError, invitations } from '../src/lib/api';
import { colors } from '../src/theme';

/** `Family.inviteCode` — eight characters, no I/O/0/1 so it survives being read aloud. */
const CODE_LENGTH = 8;

function errorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'errors.generic';
  if (error.isOffline) return 'errors.offline';
  if (error.status === 404) return 'joinFamily.errors.codeNotFound';
  if (error.status === 409) return 'joinFamily.errors.alreadyMember';
  return 'errors.generic';
}

/**
 * Joining a family with a code somebody read to you — and nothing else.
 *
 * This used to be one screen with creating (`create-family.tsx`, create/join
 * tabs), which put a second create-family form in the app next to
 * `family/new.tsx` — two doors marked "create" leading to different rooms
 * (Đạt, 2026-08-27). Now each form does one thing and cross-links the other:
 * creation happens only in `family/new`, joining only here.
 */
export default function JoinFamilyScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [code, setCode] = useState('');
  // The invitation lookup below is a plain request, not a mutation, so the
  // button's spinner needs its own flag for that leg of the trip.
  const [checkingInvite, setCheckingInvite] = useState(false);

  const join = useJoinFamily();

  const ready = code.trim().length === CODE_LENGTH;

  const submit = async () => {
    try {
      // A typed code can be either kind — the person who received it cannot
      // tell a per-spot invitation code from `Family.inviteCode`, and this
      // box is the only place in the app that takes a typed code. Ask about
      // the invitation first (`GET /invitations/:code` is public); only a
      // miss falls through to the family-code join. The order also settles
      // the one-in-a-trillion string that lives in both tables.
      const entered = code.trim().toUpperCase();
      setCheckingInvite(true);
      let isInvitation = false;
      try {
        await invitations.preview(entered);
        isInvitation = true;
      } catch {
        // Not a live invitation (or unreachable) — the join below gives the
        // honest answer either way: it fails the same way for the same cause.
      } finally {
        setCheckingInvite(false);
      }

      if (isInvitation) {
        // The invitation page says who invited them, as what, and where they
        // land — everything this bare code box cannot — and owns the accept.
        router.push({ pathname: '/invite/[code]', params: { code: entered } });
        return;
      }

      await join.mutateAsync({ inviteCode: entered });
      // Back to Home, which now has a family to show.
      safeBack(router, '/');
    } catch {
      // Rendered from `join.error` below; nothing to do here.
    }
  };

  return (
    <FormScreen
      onBack={() => safeBack(router, '/')}
      footer={
        <>
          {join.error !== null && (
            <Text
              variant="caption"
              color={colors.themes.destructive.text}
              accessibilityRole="alert"
            >
              {t(errorKey(join.error))}
            </Text>
          )}

          <Button
            label={t('joinFamily.submit')}
            size="large"
            fullWidth
            disabled={!ready}
            loading={join.isPending || checkingInvite}
            onPress={() => void submit()}
          />
        </>
      }
    >
      <View style={{ gap: 8 }}>
        <Text
          serif
          weight="bold"
          accessibilityRole="header"
          style={{ fontSize: 28, lineHeight: 36, letterSpacing: -0.4 }}
        >
          {t('joinFamily.heading')}
        </Text>

        <Text variant="body1" color={colors.text.muted}>
          {t('joinFamily.body')}
        </Text>
      </View>

      <TextField
        label={t('joinFamily.codeLabel')}
        value={code}
        onChangeText={(next) => setCode(next.toUpperCase())}
        placeholder={t('joinFamily.codePlaceholder')}
        maxLength={CODE_LENGTH}
        autoCapitalize="characters"
        autoCorrect={false}
        renderIcon={({ size, color }) => <Hash size={size} color={color} strokeWidth={2} />}
      />

      {/* The other direction of the same decision — kept one tap away since
          the no-family empty states land people on the create form first. */}
      <View style={{ alignItems: 'center' }}>
        <TextLink
          label={t('joinFamily.createLink')}
          variant="caption"
          onPress={() => router.replace('/family/new')}
        />
      </View>
    </FormScreen>
  );
}

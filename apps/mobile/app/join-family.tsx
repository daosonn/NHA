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
import { ApiError, invitations } from '../src/lib/api';
import { colors } from '../src/theme';

/** `Invitation.code` — eight characters, no I/O/0/1 so it survives being read aloud. */
const CODE_LENGTH = 8;

/**
 * Only `GET /invitations/:code` runs from here now, and it answers 404 or
 * nothing. "Already a member" used to be possible when this screen could
 * also spend a family code; the invitation page owns that case today.
 */
function errorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'errors.generic';
  if (error.isOffline) return 'errors.offline';
  if (error.status === 404) return 'joinFamily.errors.codeNotFound';
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
 *
 * The box took TWO kinds of code until 2026-09-04: it asked about an
 * invitation first and fell through to `Family.inviteCode`. That fallback is
 * gone (owner's call). A family code put the joiner in the group with no
 * relationship edges at all — a node floating beside the tree that somebody
 * else had to notice and connect — while an invitation lands them on a spot
 * that already knows who they are. Only one of those is a way into a family
 * tree, so only one is offered.
 */
export default function JoinFamilyScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [code, setCode] = useState('');
  // The lookup is a plain request, not a mutation, so the button's spinner
  // needs a flag of its own.
  const [checkingInvite, setCheckingInvite] = useState(false);

  const [failure, setFailure] = useState<unknown>(null);

  const ready = code.trim().length === CODE_LENGTH;

  const submit = async () => {
    const entered = code.trim().toUpperCase();
    setCheckingInvite(true);
    setFailure(null);
    try {
      // `GET /invitations/:code` is public, so this works before the person
      // is anybody in this family. It is only a look: the invitation page it
      // hands over to says who invited them, as what, and where they land —
      // everything a bare code box cannot — and owns the accept.
      await invitations.preview(entered);
      router.push({ pathname: '/invite/[code]', params: { code: entered } });
    } catch (error) {
      setFailure(error);
    } finally {
      setCheckingInvite(false);
    }
  };

  return (
    <FormScreen
      onBack={() => safeBack(router, '/')}
      footer={
        <>
          {failure !== null && (
            <Text
              variant="caption"
              color={colors.themes.destructive.text}
              accessibilityRole="alert"
            >
              {t(errorKey(failure))}
            </Text>
          )}

          <Button
            label={t('joinFamily.submit')}
            size="large"
            fullWidth
            disabled={!ready}
            loading={checkingInvite}
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

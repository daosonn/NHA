import { Hash, UsersRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { FormScreen } from '../src/components/layout/form-screen';
import { Button } from '../src/components/ui/button';
import { SegmentedTabs } from '../src/components/ui/segmented-tabs';
import { Text } from '../src/components/ui/text';
import { TextField } from '../src/components/ui/text-field';
import { useCreateFamily, useJoinFamily } from '../src/features/family/use-family-mutations';
import { ApiError } from '../src/lib/api';
import { colors } from '../src/theme';
import { goBack } from '../src/lib/navigation';

type Mode = 'create' | 'join';

/** `Family.inviteCode` — eight characters, no I/O/0/1 so it survives being read aloud. */
const CODE_LENGTH = 8;
const MAX_NAME = 100;

function errorKey(error: unknown, mode: Mode): string {
  if (!(error instanceof ApiError)) return 'errors.generic';
  if (error.isOffline) return 'errors.offline';

  if (mode === 'join') {
    if (error.status === 404) return 'createFamily.errors.codeNotFound';
    if (error.status === 409) return 'createFamily.errors.alreadyMember';
  }

  return 'errors.generic';
}

/**
 * The way out of an account with no family.
 *
 * Create and join are one screen because they are the same decision made
 * from two directions — you either start the space or you were handed a way
 * into one — and a person who guessed wrong should not have to go back a
 * screen to correct it.
 */
export default function CreateFamilyScreen() {
  const { t } = useTranslation();

  const [mode, setMode] = useState<Mode>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const create = useCreateFamily();
  const join = useJoinFamily();
  const active = mode === 'create' ? create : join;

  const ready = mode === 'create' ? name.trim().length > 0 : code.trim().length === CODE_LENGTH;

  const submit = async () => {
    try {
      if (mode === 'create') {
        await create.mutateAsync({ name: name.trim() });
      } else {
        await join.mutateAsync({ inviteCode: code.trim().toUpperCase() });
      }
      // Back to Home, which now has a family to show.
      goBack();
    } catch {
      // Rendered from `active.error` below; nothing to do here.
    }
  };

  return (
    <FormScreen
      onBack={() => goBack()}
      footer={
        <>
          {active.error !== null && (
            <Text
              variant="caption"
              color={colors.themes.destructive.text}
              accessibilityRole="alert"
            >
              {t(errorKey(active.error, mode))}
            </Text>
          )}

          <Button
            label={
              mode === 'create' ? t('createFamily.createSubmit') : t('createFamily.joinSubmit')
            }
            size="large"
            fullWidth
            disabled={!ready}
            loading={active.isPending}
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
          {mode === 'create' ? t('createFamily.createHeading') : t('createFamily.joinHeading')}
        </Text>

        <Text variant="body1" color={colors.text.muted}>
          {mode === 'create' ? t('createFamily.createBody') : t('createFamily.joinBody')}
        </Text>
      </View>

      <SegmentedTabs
        options={[
          { value: 'create', label: t('createFamily.createTab') },
          { value: 'join', label: t('createFamily.joinTab') },
        ]}
        value={mode}
        onChange={setMode}
        accessibilityLabel={t('createFamily.title')}
      />

      {mode === 'create' ? (
        <TextField
          label={t('createFamily.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('createFamily.namePlaceholder')}
          maxLength={MAX_NAME}
          renderIcon={({ size, color }) => <UsersRound size={size} color={color} strokeWidth={2} />}
        />
      ) : (
        <TextField
          label={t('createFamily.codeLabel')}
          value={code}
          onChangeText={(next) => setCode(next.toUpperCase())}
          placeholder={t('createFamily.codePlaceholder')}
          maxLength={CODE_LENGTH}
          autoCapitalize="characters"
          autoCorrect={false}
          renderIcon={({ size, color }) => <Hash size={size} color={color} strokeWidth={2} />}
        />
      )}
    </FormScreen>
  );
}

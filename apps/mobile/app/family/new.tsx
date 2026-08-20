import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { InviteCodeCard } from '../../src/components/family/invite-code-card';
import { FormScreen } from '../../src/components/layout/form-screen';
import { Avatar } from '../../src/components/ui/avatar';
import { BrandMark } from '../../src/components/ui/brand-mark';
import { Button } from '../../src/components/ui/button';
import { Text } from '../../src/components/ui/text';
import { TextField } from '../../src/components/ui/text-field';
import { useSession } from '../../src/features/auth/session';
import { useCreateFamily } from '../../src/features/family/use-family-mutations';
import { ApiError, type FamilyDetail } from '../../src/lib/api';
import { colors, radius } from '../../src/theme';

/**
 * Shorter than the server's 100. A group name is read inside a 34px avatar
 * strip, so anything longer is truncated before anyone sees it.
 */
const MAX_NAME = 30;

/** Ready-made names, because most second groups are one of a few things. */
const SUGGESTION_KEYS = [
  'family.new.suggestions.momsSide',
  'family.new.suggestions.dadsSide',
  'family.new.suggestions.grandparents',
];

/** The group's mark until families can carry a photo of their own. */
function GroupMark() {
  const { t } = useTranslation();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius['4xl'],
          backgroundColor: colors.coral.light,
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 0 0 1px rgba(245,139,123,0.28)',
        }}
      >
        <BrandMark size={28} />
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="body2" weight="semibold">
          {t('family.new.markTitle')}
        </Text>
        <Text variant="caption" color={colors.text.subtle}>
          {t('family.new.markBody')}
        </Text>
      </View>
    </View>
  );
}

/**
 * Start a second family group, from the + on the family strip.
 *
 * Separate from `app/create-family.tsx`, which is the way out of an account
 * with no family at all and therefore offers joining as well. By the time
 * somebody taps the +, they already have a group and are deliberately making
 * another one.
 *
 * Two states, because the invite code cannot exist before the group does:
 * the server mints `Family.inviteCode` inside `POST /families`. The mockup
 * shows the code on the form, which would mean inventing eight characters and
 * hoping the server agrees. So the form creates the group, and the code is
 * handed over on the way out.
 */
export default function NewFamilyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useSession();

  const [name, setName] = useState('');
  const [created, setCreated] = useState<FamilyDetail | null>(null);

  const create = useCreateFamily();

  const ready = name.trim().length > 0;

  const submit = async () => {
    if (!ready) return;

    try {
      setCreated(await create.mutateAsync({ name: name.trim() }));
    } catch {
      // Rendered from `create.error` below; nothing to do here.
    }
  };

  const errorKey =
    create.error === null
      ? null
      : create.error instanceof ApiError && create.error.isOffline
        ? 'errors.offline'
        : 'errors.generic';

  if (created !== null) {
    return (
      <FormScreen
        title={t('family.new.doneTitle')}
        onClose={() => router.back()}
        footer={
          <Button
            label={t('family.new.done')}
            size="large"
            fullWidth
            onPress={() => router.back()}
          />
        }
      >
        <View style={{ alignItems: 'center', gap: 12, paddingTop: 8 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.full,
              backgroundColor: colors.coral.light,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Check size={26} color={colors.coral.deep} strokeWidth={2.4} />
          </View>

          <Text
            serif
            weight="bold"
            accessibilityRole="header"
            style={{ fontSize: 24, lineHeight: 32, letterSpacing: -0.4, textAlign: 'center' }}
          >
            {created.name}
          </Text>

          <Text variant="body2" color={colors.text.muted} style={{ textAlign: 'center' }}>
            {t('family.new.doneBody')}
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="caption" weight="semibold" color={colors.text.secondary}>
            {t('family.new.codeLabel')}
          </Text>

          <InviteCodeCard code={created.inviteCode} subtitle={t('family.new.codeMeta')} />

          <Text variant="badge" color={colors.text.subtle}>
            {t('family.new.codeHint')}
          </Text>
        </View>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title={t('family.new.title')}
      onClose={() => router.back()}
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
            label={t('family.new.submit')}
            size="large"
            fullWidth
            disabled={!ready}
            loading={create.isPending}
            onPress={() => void submit()}
          />
        </>
      }
    >
      <GroupMark />

      <View style={{ gap: 8 }}>
        <TextField
          label={t('family.new.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('family.new.namePlaceholder')}
          maxLength={MAX_NAME}
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {SUGGESTION_KEYS.map((key) => {
            const suggestion = t(key);

            return (
              <Pressable
                key={key}
                onPress={() => setName(suggestion)}
                accessibilityRole="button"
                accessibilityLabel={t('family.new.useSuggestion', { name: suggestion })}
                style={{
                  height: 30,
                  paddingHorizontal: 12,
                  borderRadius: radius.full,
                  backgroundColor: colors.background.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `inset 0 0 0 1px ${colors.state.borderDefault}`,
                }}
              >
                <Text variant="caption" weight="medium" color={colors.text.secondary}>
                  {suggestion}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="caption" weight="semibold" color={colors.text.secondary}>
          {t('family.new.youLabel')}
        </Text>

        <View
          style={{
            minHeight: 64,
            borderRadius: radius.xl,
            backgroundColor: colors.background.card,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            boxShadow: 'inset 0 0 0 1px rgba(24,24,27,0.06)',
          }}
        >
          <Avatar
            size={40}
            name={name.trim()}
            ring="0 0 0 2px #FFFFFF, 0 0 0 3px rgba(240,112,95,0.35)"
          />

          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="body2" weight="semibold">
              {t('family.new.youName', { name: user?.name ?? t('family.new.youFallback') })}
            </Text>
            {/* The mockup puts a relationship picker here ("Son"). A brand-new
                group has exactly one member, so there is nobody for that
                relationship to point at — `Relationship` needs two members.
                Relations get set when the second person arrives. */}
            <Text variant="badge" color={colors.text.subtle}>
              {t('family.new.youHint')}
            </Text>
          </View>
        </View>
      </View>
    </FormScreen>
  );
}

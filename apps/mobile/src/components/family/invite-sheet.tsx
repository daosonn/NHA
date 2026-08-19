import { Check, Share2, UserRoundPlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Share, View } from 'react-native';

import { kinshipOptions, type KinshipOption } from '../../features/family/kinship';
import type { InvitationSummary } from '../../lib/api';
import { daysUntil } from '../../lib/date';
import { colors, elevation, radius } from '../../theme';
import { Button } from '../ui/button';
import { SelectField } from '../ui/select-field';
import { Text } from '../ui/text';
import { TextField } from '../ui/text-field';
import { InviteCodeCard } from './invite-code-card';

function SheetHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="h2" weight="bold" style={{ letterSpacing: -0.3 }}>
          {title}
        </Text>
        <Text variant="body2" color={colors.text.muted}>
          {subtitle}
        </Text>
      </View>

      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        hitSlop={8}
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.full,
          backgroundColor: colors.background.subtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={17} color={colors.text.secondary} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

/**
 * The spot being reserved, described from the form above it.
 *
 * It used to read "Gen 3 · beside Minh · child of Mai & Hoang" from a fixture,
 * on every invite, whoever was being invited. The spot does not exist until
 * the request is sent, so the only honest thing to show beforehand is what
 * the inviter has typed and picked — which is also the thing they might have
 * got wrong.
 */
function SpotCard({ name, option }: { name: string; option: KinshipOption | undefined }) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        borderRadius: radius.xl,
        backgroundColor: colors.coral.light,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.full,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: colors.coral.borderSoft,
          backgroundColor: 'rgba(255,255,255,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <UserRoundPlus size={19} color={colors.coral.dark} strokeWidth={2} />
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body2" weight="semibold" numberOfLines={1}>
          {name === '' ? t('invite.sheet.spotEmpty') : name}
        </Text>
        <Text variant="badge" color={colors.text.subtle} numberOfLines={1}>
          {option === undefined ? t('invite.sheet.spotUnset') : t(option.hintKey)}
        </Text>
      </View>
    </View>
  );
}

export type InviteSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Named throughout, so the sender can see which door they are opening. */
  familyName: string;
  /**
   * The invitation that was just created. Non-null switches the sheet to its
   * second state — the code exists only once the server has reserved the spot,
   * so there is nothing to show before this.
   */
  created: InvitationSummary | null;
  onSubmit?: (input: { name: string; option: KinshipOption }) => void;
  submitting?: boolean;
  /** Catalogue key for whatever went wrong, shown above the button. */
  errorKey?: string | null;
};

/**
 * Inviting one person to one place in the tree.
 *
 * Two states in one sheet, because they are one act: fill in who is coming
 * and as what, then hand over the code that arrives back. The code is per
 * invitation, not `Family.inviteCode` — that distinction is what lets the
 * copy promise the invitee lands on the reserved spot, which a family-wide
 * code could never do.
 *
 * A plain `Modal` rather than `@gorhom/bottom-sheet`: this is a form, not a
 * gesture surface. The tree's pinch/pan is where that library earns its place.
 */
export function InviteSheet({
  visible,
  onClose,
  familyName,
  created,
  onSubmit,
  submitting = false,
  errorKey = null,
}: InviteSheetProps) {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [kinship, setKinship] = useState<string>(kinshipOptions[0]?.value ?? 'sister');

  const chosen = kinshipOptions.find((option) => option.value === kinship);
  const expiresIn = created === null ? null : daysUntil(created.expiresAt);

  const share = (code: string, invitee: string) => {
    void Share.share({
      message: t('invite.sheet.shareMessage', {
        name: invitee,
        code,
        family: familyName,
      }),
    });
  };

  /** Both states leave the form blank, so the next invite starts clean. */
  const close = () => {
    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel={t('invite.sheet.closeScrim')}
        style={{ flex: 1, backgroundColor: colors.state.scrim }}
      />

      <View
        style={[
          {
            maxHeight: '92%',
            borderTopLeftRadius: radius['7xl'],
            borderTopRightRadius: radius['7xl'],
            backgroundColor: colors.background.page,
            paddingTop: 10,
          },
          elevation.sheet,
        ]}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 44,
            height: 5,
            borderRadius: radius.full,
            backgroundColor: '#E2DCD7',
          }}
        />

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 34, gap: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {created === null ? (
            <>
              <SheetHeader
                title={t('invite.sheet.title')}
                subtitle={t('invite.sheet.subtitle')}
                onClose={close}
              />

              <SpotCard name={name.trim()} option={chosen} />

              <TextField
                label={t('invite.sheet.nameLabel')}
                value={name}
                onChangeText={setName}
                placeholder={t('invite.sheet.namePlaceholder')}
                maxLength={50}
              />

              <SelectField
                label={t('invite.sheet.relationship')}
                title={t('invite.sheet.relationshipTitle')}
                value={kinship}
                options={kinshipOptions.map((option) => ({
                  value: option.value,
                  label: t(option.labelKey),
                }))}
                onChange={setKinship}
              />

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
                label={t('invite.sheet.send')}
                size="large"
                fullWidth
                disabled={name.trim() === '' || chosen === undefined}
                loading={submitting}
                onPress={() => {
                  if (onSubmit === undefined || chosen === undefined) return;
                  onSubmit({ name: name.trim(), option: chosen });
                }}
                renderIcon={({ size, color }) => (
                  <UserRoundPlus size={size} color={color} strokeWidth={2.1} />
                )}
              />
            </>
          ) : (
            <>
              <SheetHeader
                title={t('invite.sheet.sentTitle', { name: created.name })}
                subtitle={t('invite.sheet.sentSubtitle')}
                onClose={close}
              />

              <View style={{ gap: 10 }}>
                <Text variant="caption" weight="semibold" color={colors.text.secondary}>
                  {t('invite.sheet.codeHeading')}
                </Text>

                {/* The deadline is the one thing about a code that changes
                    on its own, so it is named rather than left to be
                    discovered when it stops working. `daysUntil` returns
                    null for a date already gone, which cannot happen on a
                    just-created invitation but is not worth asserting. */}
                <InviteCodeCard
                  code={created.code}
                  subtitle={
                    expiresIn === null
                      ? t('invite.sheet.codeMetaPlain', { family: familyName })
                      : t('invite.sheet.codeMeta', { family: familyName, count: expiresIn })
                  }
                />

                {/* True now, and it was not before: a per-invitation code
                    carries the reserved spot, so the person who types it
                    lands where the inviter put them rather than arriving
                    unattached. The old family-wide code could not. */}
                <Text variant="badge" color={colors.text.subtle}>
                  {t('invite.sheet.codeHint', { name: created.name, family: familyName })}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => share(created.code, created.name)}
                  accessibilityRole="button"
                  accessibilityLabel={t('invite.sheet.share')}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: radius.full,
                    backgroundColor: colors.background.card,
                    borderWidth: 1.5,
                    borderColor: colors.state.disabledBorder,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Share2 size={21} color={colors.text.secondary} strokeWidth={2} />
                </Pressable>

                <View style={{ flex: 1 }}>
                  <Button
                    label={t('invite.sheet.done')}
                    size="large"
                    fullWidth
                    onPress={close}
                    renderIcon={({ size, color }) => (
                      <Check size={size} color={color} strokeWidth={2.2} />
                    )}
                  />
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

import { Check, MailCheck, Share2, UserRoundPlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Share, View } from 'react-native';

import { kinshipOptions, type KinshipOption } from '../../features/family/kinship';
import type { SlotKind } from './tree-slots';
import type { InvitationSummary } from '../../lib/api';
import { daysUntil } from '../../lib/date';
import { colors, elevation, radius } from '../../theme';
import { Button } from '../ui/button';
import { SegmentedTabs } from '../ui/segmented-tabs';
import { SelectField } from '../ui/select-field';
import { SheetModal } from '../ui/sheet-modal';
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
function SpotCard({ name, hint }: { name: string; hint: string }) {
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
          {hint}
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
  /**
   * The dashed slot this sheet was opened from, when edit mode did the
   * choosing: the relationship is already decided by WHERE the tap landed,
   * so the kinship picker disappears and the spot card says the placement in
   * words ("Will appear as Mai's mother"). `null`/absent keeps the classic
   * form with the picker — the empty-tree state still uses it.
   */
  spot?: { kind: SlotKind; anchorName: string } | null;
  /** `option` is null exactly when `spot` decided the relationship instead. */
  onSubmit?: (input: { name: string; option: KinshipOption | null; email: string }) => void;
  submitting?: boolean;
  /** Catalogue key for whatever went wrong, shown above the button. */
  errorKey?: string | null;
  /**
   * What went wrong with the address specifically, shown on the field.
   * "Nobody uses that email" is about the thing they typed, and an error
   * about a field belongs against that field — not in a line at the bottom
   * that leaves them hunting for which input to fix.
   */
  emailErrorKey?: string | null;
};

/**
 * How the invitation travels — the sender picks, explicitly.
 *
 * It used to be one optional email field whose emptiness silently chose the
 * delivery: filled meant a notification, blank meant a code. Nobody reads a
 * hint under an optional field, so senders discovered which one they had
 * picked only at the second screen. Two named tabs put the choice — and who
 * each one is for — in front of the decision instead of behind it.
 */
type InviteMethod = 'email' | 'code';

/** Enough to stop typos, not a validator — the server has the real answer
 *  (404 for an address with no account behind it). */
function looksLikeEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value);
}

/**
 * Inviting one person to one place in the tree.
 *
 * Two states in one sheet, because they are one act: fill in who is coming,
 * as what, and how the invitation reaches them — then either confirm the
 * notification went out (email) or hand over the code that arrives back
 * (code). The code is per invitation, not `Family.inviteCode` — that
 * distinction is what lets the copy promise the invitee lands on the
 * reserved spot, which a family-wide code could never do.
 *
 * A plain `Modal` rather than `@gorhom/bottom-sheet`: this is a form, not a
 * gesture surface. The tree's pinch/pan is where that library earns its place.
 */
export function InviteSheet({
  visible,
  onClose,
  familyName,
  created,
  spot = null,
  onSubmit,
  submitting = false,
  errorKey = null,
  emailErrorKey = null,
}: InviteSheetProps) {
  const { t } = useTranslation();

  const [method, setMethod] = useState<InviteMethod>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [kinship, setKinship] = useState<string>(kinshipOptions[0]?.value ?? 'sister');

  const chosen = kinshipOptions.find((option) => option.value === kinship);
  const spotHint =
    spot !== null
      ? t(`family.slots.will.${spot.kind}`, { name: spot.anchorName })
      : chosen === undefined
        ? t('invite.sheet.spotUnset')
        : t(chosen.hintKey);
  const expiresIn = created === null ? null : daysUntil(created.expiresAt);

  // What the second screen confirms is decided by the server's answer, not
  // by which tab was open: an addressed invitation has an invitee, a
  // hand-over one does not.
  const sentByEmail = created !== null && created.inviteeUserId !== null;

  const ready =
    name.trim() !== '' &&
    (spot !== null || chosen !== undefined) &&
    (method === 'code' || looksLikeEmail(email.trim()));

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
    setEmail('');
    onClose();
  };

  return (
    <SheetModal
      visible={visible}
      onClose={close}
      scrimLabel={t('invite.sheet.closeScrim')}
      style={{ maxHeight: '92%' }}
    >
      <View
        style={[
          {
            flexShrink: 1,
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

              <View style={{ gap: 8 }}>
                <SegmentedTabs
                  options={[
                    { value: 'email', label: t('invite.sheet.methodEmail') },
                    { value: 'code', label: t('invite.sheet.methodCode') },
                  ]}
                  value={method}
                  onChange={setMethod}
                  accessibilityLabel={t('invite.sheet.methodTitle')}
                />
                {/* Who each door is for, said before the choice is made —
                    this line replaced the hint under the old optional email
                    field, which explained the same thing after the fact. */}
                <Text variant="badge" color={colors.text.subtle}>
                  {method === 'email'
                    ? t('invite.sheet.methodEmailHint')
                    : t('invite.sheet.methodCodeHint')}
                </Text>
              </View>

              <SpotCard name={name.trim()} hint={spotHint} />

              <TextField
                label={t('invite.sheet.nameLabel')}
                value={name}
                onChangeText={setName}
                placeholder={t('invite.sheet.namePlaceholder')}
                maxLength={50}
              />

              {method === 'email' && (
                <TextField
                  label={t('invite.sheet.emailLabel')}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('invite.sheet.emailPlaceholder')}
                  error={emailErrorKey === null ? undefined : t(emailErrorKey)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={254}
                />
              )}

              {/* The slot already said the relationship — offering the picker
                  again would let the form contradict the dashed preview the
                  person just tapped. */}
              {spot === null && (
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
              )}

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
                disabled={!ready}
                loading={submitting}
                onPress={() => {
                  if (onSubmit === undefined) return;
                  if (spot === null && chosen === undefined) return;
                  onSubmit({
                    name: name.trim(),
                    // Null when the slot decided — the screen maps the slot
                    // kind to the stored edge instead.
                    option: spot === null ? (chosen ?? null) : null,
                    // The code tab sends no address even if one was typed on
                    // the other tab — what is submitted is what is on screen.
                    email: method === 'email' ? email.trim() : '',
                  });
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
                subtitle={
                  sentByEmail ? t('invite.sheet.sentEmailSubtitle') : t('invite.sheet.sentSubtitle')
                }
                onClose={close}
              />

              {sentByEmail ? (
                /* Addressed invitation: nothing to hand over — the code
                   underneath only answers to that account. What the sender
                   needs back is the address they typed, because a typo here
                   is invisible everywhere else. */
                <View
                  style={{
                    borderRadius: radius.xl,
                    backgroundColor: colors.coral.light,
                    padding: 14,
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
                      backgroundColor: 'rgba(255,255,255,0.6)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MailCheck size={19} color={colors.coral.dark} strokeWidth={2} />
                  </View>

                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="body2" weight="semibold" numberOfLines={1}>
                      {email.trim()}
                    </Text>
                    <Text variant="badge" color={colors.text.subtle}>
                      {expiresIn === null
                        ? t('invite.sheet.codeMetaPlain', { family: familyName })
                        : t('invite.sheet.codeMeta', { family: familyName, count: expiresIn })}
                    </Text>
                  </View>
                </View>
              ) : (
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
              )}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                {!sentByEmail && (
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
                )}

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
    </SheetModal>
  );
}

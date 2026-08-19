import { Share2, UserRoundPlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Share, View } from 'react-native';

import { colors, elevation, radius } from '../../theme';
import {
  defaultSpot,
  kinshipOptions,
  type KinshipOption,
  type TreeSpot,
} from '../../fixtures/invite';
import { Button } from '../ui/button';
import { SelectField } from '../ui/select-field';
import { Text } from '../ui/text';
import { TextField } from '../ui/text-field';
import { InviteCodeCard } from './invite-code-card';

function SheetHeader({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="h2" weight="bold" style={{ letterSpacing: -0.3 }}>
          {t('invite.sheet.title')}
        </Text>
        <Text variant="body2" color={colors.text.muted}>
          {t('invite.sheet.subtitle')}
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

/** The reserved spot, so the inviter can see what they are filling. */
function SpotCard({ spot }: { spot: TreeSpot }) {
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
        <Text variant="body2" weight="semibold">
          {t('invite.sheet.spot', { id: spot.id })}
        </Text>
        <Text variant="badge" color={colors.text.subtle}>
          {spot.summary}
        </Text>
      </View>
    </View>
  );
}

export type InviteSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The empty node that was tapped, if the flow started from the tree. */
  spot?: TreeSpot;
  /** `Family.inviteCode` — the 8 characters the receiver types. */
  code: string;
  /** Named in the code card, so the sender can see which family they are opening. */
  familyName: string;
  /**
   * Creates the spot. Called with the name and the kinship shortcut, which
   * carries the `RelationshipType` and the direction the edge points.
   * Omitted while the screen has nothing to write to.
   */
  onSubmit?: (input: { name: string; option: KinshipOption }) => void;
  submitting?: boolean;
  /** Catalogue key for whatever went wrong, shown above the button. */
  errorKey?: string | null;
};

/**
 * The invite flow from the family tree.
 *
 * A plain `Modal` rather than `@gorhom/bottom-sheet`: this is a form, not a
 * gesture surface, and pulling in a native gesture dependency for a slide-up
 * would buy nothing here. The tree's pinch/pan is where that library earns
 * its place.
 */
export function InviteSheet({
  visible,
  onClose,
  spot = defaultSpot,
  code,
  familyName,
  onSubmit,
  submitting = false,
  errorKey = null,
}: InviteSheetProps) {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [kinship, setKinship] = useState<string>(kinshipOptions[0]?.value ?? 'sister');

  const chosen: KinshipOption | undefined = kinshipOptions.find(
    (option) => option.value === kinship,
  );

  const share = () => {
    void Share.share({
      message: t('invite.sheet.shareMessage', {
        name: name.trim() === '' ? t('invite.sheet.shareFallbackName') : name.trim(),
        code,
        family: familyName,
      }),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
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
          <SheetHeader onClose={onClose} />

          <SpotCard spot={spot} />

          <TextField
            label={t('invite.sheet.nameLabel')}
            value={name}
            onChangeText={setName}
            placeholder={t('invite.sheet.namePlaceholder')}
            maxLength={24}
          />

          <SelectField
            label={t('invite.sheet.relationship')}
            title={t('invite.sheet.relationshipTitle')}
            value={kinship}
            options={kinshipOptions}
            onChange={setKinship}
          />

          <View style={{ gap: 10 }}>
            <Text variant="caption" weight="semibold" color={colors.text.secondary}>
              {t('invite.sheet.codeHeading')}
            </Text>

            <InviteCodeCard
              code={code}
              subtitle={t('invite.sheet.codeMeta', { family: familyName })}
            />

            {/* What the code actually does today. The mockup promised it would
                drop them into the reserved spot; a family-wide code cannot —
                `POST /families/join` takes a `linkMemberId`, but a bare code
                does not carry one. Saying so is cheaper than a surprise. */}
            <Text variant="badge" color={colors.text.subtle}>
              {t('invite.sheet.codeHint', { family: familyName })}
            </Text>
          </View>

          {errorKey !== null && (
            <Text
              variant="caption"
              color={colors.themes.destructive.text}
              accessibilityRole="alert"
            >
              {t(errorKey)}
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={share}
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
                label={t('invite.sheet.save')}
                size="large"
                fullWidth
                disabled={name.trim() === '' || chosen === undefined}
                loading={submitting}
                onPress={() => {
                  if (onSubmit === undefined || chosen === undefined) {
                    onClose();
                    return;
                  }
                  onSubmit({ name: name.trim(), option: chosen });
                }}
                renderIcon={({ size, color }) => (
                  <UserRoundPlus size={size} color={color} strokeWidth={2.1} />
                )}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

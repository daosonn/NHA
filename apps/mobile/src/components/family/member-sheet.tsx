import { Lock, Trash2, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { edgeBetween, removalBlock } from '../../features/family/member-permissions';
import { kinshipOptions, type KinshipOption } from '../../features/family/kinship';
import type { FamilyMemberSummary, FamilyTree, Gender } from '../../lib/api';
import { colors, elevation, radius } from '../../theme';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { SelectField } from '../ui/select-field';
import { Text } from '../ui/text';
import { TextField } from '../ui/text-field';

const MAX_NAME = 100;

const GENDERS: Gender[] = ['FEMALE', 'MALE', 'OTHER'];

const GENDER_KEY: Record<Gender, string> = {
  FEMALE: 'family.member.gender.female',
  MALE: 'family.member.gender.male',
  OTHER: 'family.member.gender.other',
};

export type MemberEditsOut = {
  displayName?: string;
  gender?: Gender;
  relationship?: {
    currentId: string | null;
    anchorMemberId: string;
    type: KinshipOption['type'];
    memberIsFrom: boolean;
  };
};

export type MemberSheetProps = {
  /** The member being managed. `null` closes the sheet. */
  member: FamilyMemberSummary | null;
  tree: FamilyTree;
  /** The viewer's own node, which every kinship word is measured from. */
  anchorMemberId: string | null;
  viewerUserId: string | null;
  onClose: () => void;
  onSave: (edits: MemberEditsOut) => void;
  onRemove: () => void;
  saving?: boolean;
  removing?: boolean;
  /** Catalogue key for whatever went wrong, shown above the actions. */
  errorKey?: string | null;
};

/**
 * What the family may change about somebody: their name, their gender, and
 * where they sit relative to you.
 *
 * Opened by a long press on a tree node — a tap still opens their Life
 * Profile, which is what the tree is mainly for (task 1.4.3).
 *
 * The split of what is editable here is the server's, not a design choice
 * (`family.service.ts`): a placeholder is the family's to curate, while an
 * account holder's name and membership are theirs alone. Relationships are
 * different again — anyone in the family may draw or cut an edge, because a
 * relationship belongs to the pair rather than to either person.
 */
export function MemberSheet({
  member,
  tree,
  anchorMemberId,
  viewerUserId,
  onClose,
  onSave,
  onRemove,
  saving = false,
  removing = false,
  errorKey = null,
}: MemberSheetProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={member !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('family.member.closeScrim')}
        style={{ flex: 1, backgroundColor: colors.state.scrim }}
      />

      {member !== null && (
        <MemberSheetBody
          // Remounts when a different node is opened, so the fields reseed.
          key={member.id}
          member={member}
          tree={tree}
          anchorMemberId={anchorMemberId}
          viewerUserId={viewerUserId}
          onClose={onClose}
          onSave={onSave}
          onRemove={onRemove}
          saving={saving}
          removing={removing}
          errorKey={errorKey}
        />
      )}
    </Modal>
  );
}

function MemberSheetBody({
  member,
  tree,
  anchorMemberId,
  viewerUserId,
  onClose,
  onSave,
  onRemove,
  saving,
  removing,
  errorKey,
}: Omit<MemberSheetProps, 'member' | 'saving' | 'removing' | 'errorKey'> & {
  member: FamilyMemberSummary;
  saving: boolean;
  removing: boolean;
  errorKey: string | null;
}) {
  const { t } = useTranslation();

  const manageable = member.userId === null || member.userId === viewerUserId;
  const isSelf = member.userId !== null && member.userId === viewerUserId;
  const block = removalBlock(tree, member, viewerUserId);

  const current = anchorMemberId === null ? null : edgeBetween(tree, member.id, anchorMemberId);

  /** The kinship shortcut that matches the edge already stored, if any. */
  const currentKinship =
    current === null || anchorMemberId === null
      ? undefined
      : kinshipOptions.find(
          (option) =>
            option.type === current.type &&
            option.newMemberIsFrom === (current.fromMemberId === member.id),
        );

  const [name, setName] = useState(member.displayName);
  const [gender, setGender] = useState<Gender | null>(member.gender);
  const [kinship, setKinship] = useState<string | null>(currentKinship?.value ?? null);

  const chosen = kinshipOptions.find((option) => option.value === kinship);

  const nameChanged = manageable && name.trim() !== '' && name.trim() !== member.displayName;
  const genderChanged = manageable && gender !== null && gender !== member.gender;
  const kinshipChanged =
    anchorMemberId !== null &&
    !isSelf &&
    chosen !== undefined &&
    chosen.value !== currentKinship?.value;

  const dirty = nameChanged || genderChanged || kinshipChanged;

  const save = () => {
    if (!dirty) return;

    onSave({
      displayName: nameChanged ? name.trim() : undefined,
      gender: genderChanged && gender !== null ? gender : undefined,
      relationship:
        kinshipChanged && chosen !== undefined && anchorMemberId !== null
          ? {
              currentId: current?.id ?? null,
              anchorMemberId,
              type: chosen.type,
              memberIsFrom: chosen.newMemberIsFrom,
            }
          : undefined,
    });
  };

  return (
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar size={48} ring={`0 0 0 2px ${colors.background.page}`} />

          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h2" weight="bold" style={{ letterSpacing: -0.3 }}>
              {t('family.member.title')}
            </Text>
            <Text variant="body2" color={colors.text.muted}>
              {member.displayName}
            </Text>
          </View>
        </View>

        {manageable ? (
          <>
            <TextField
              label={t('family.member.nameLabel')}
              value={name}
              onChangeText={setName}
              placeholder={t('family.member.namePlaceholder')}
              maxLength={MAX_NAME}
            />

            <SelectField
              label={t('family.member.genderLabel')}
              title={t('family.member.genderTitle')}
              value={gender ?? ''}
              options={GENDERS.map((value) => ({ value, label: t(GENDER_KEY[value]) }))}
              onChange={(next) => setGender(next as Gender)}
            />
          </>
        ) : (
          // An account holder's own details are theirs. Said once, plainly,
          // rather than shown as fields that refuse to work.
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              padding: 12,
              borderRadius: radius.md,
              backgroundColor: colors.background.subtle,
            }}
          >
            <Lock size={14} color={colors.text.muted} strokeWidth={2} />
            <Text variant="caption" color={colors.text.muted} style={{ flex: 1 }}>
              {t('family.member.theirsToEdit', { name: member.displayName })}
            </Text>
          </View>
        )}

        {/* A relationship belongs to the pair, so anyone in the family may
            change it — including for someone whose own details are locked. */}
        {anchorMemberId !== null && !isSelf && (
          <View style={{ gap: 6 }}>
            <SelectField
              label={t('family.member.relationshipLabel')}
              title={t('family.member.relationshipTitle', { name: member.displayName })}
              value={kinship ?? ''}
              options={kinshipOptions.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
              }))}
              onChange={setKinship}
            />

            {current === null && (
              <Text variant="badge" color={colors.text.subtle}>
                {t('family.member.noRelationYet')}
              </Text>
            )}
          </View>
        )}

        {errorKey !== null && (
          <Text variant="caption" color={colors.themes.destructive.text} accessibilityRole="alert">
            {t(errorKey)}
          </Text>
        )}

        <Button
          label={t('family.member.save')}
          size="large"
          fullWidth
          disabled={!dirty}
          loading={saving}
          onPress={save}
        />

        <View style={{ gap: 6 }}>
          <Button
            label={t('family.member.remove')}
            variant="destructive"
            size="large"
            fullWidth
            disabled={block !== null}
            loading={removing}
            onPress={onRemove}
            renderIcon={({ size, color }) => <Trash2 size={size} color={color} strokeWidth={2.1} />}
          />

          {/* React Native has no tooltip, and a disabled button that will not
              say why is its own small cruelty. The reason goes underneath. */}
          {block !== null && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <UserRound size={13} color={colors.text.subtle} strokeWidth={2} />
              <Text variant="badge" color={colors.text.subtle} style={{ flex: 1 }}>
                {t(
                  block === 'hasChildren'
                    ? 'family.member.blocked.hasChildren'
                    : 'family.member.blocked.notYours',
                )}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

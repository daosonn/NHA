import { Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';

import { colors, elevation, radius } from '../../theme';
import { Button } from '../ui/button';
import { Text } from '../ui/text';

export type MemoDeleteDialogProps = {
  visible: boolean;
  /** How many photos go with the note. Named in the warning. */
  photoCount: number;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * The one confirmation before a note is gone.
 *
 * It names the photo count because that is the part people forget: the words
 * can be retyped, the picture of the shop front cannot.
 *
 * The copy says "you", not "the family". A memo is private to its author
 * (`docs/00-shared/domain-model.md`), so deleting one takes nothing away from
 * anybody else — telling the user otherwise would be a small lie in a dialog
 * whose whole job is to be believed.
 */
export function MemoDeleteDialog({
  visible,
  photoCount,
  onConfirm,
  onCancel,
}: MemoDeleteDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel={t('member.memoDelete.dismiss')}
        style={{
          flex: 1,
          backgroundColor: colors.state.scrim,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 26,
        }}
      >
        {/* Swallows taps so the scrim above does not close the dialog when
            someone reaches for a button and misses it by a few pixels. */}
        <Pressable
          onPress={() => {}}
          style={[
            {
              alignSelf: 'stretch',
              borderRadius: radius['6xl'],
              backgroundColor: colors.background.page,
              paddingHorizontal: 22,
              paddingTop: 24,
              paddingBottom: 20,
              alignItems: 'center',
              gap: 12,
            },
            elevation.floating,
          ]}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.full,
              backgroundColor: colors.coral.light,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Trash2 size={24} color={colors.coral.deep} strokeWidth={2} />
          </View>

          <Text
            variant="h2"
            weight="bold"
            accessibilityRole="header"
            style={{ letterSpacing: -0.3, textAlign: 'center' }}
          >
            {t('member.memoDelete.title')}
          </Text>

          <Text variant="body2" color={colors.text.muted} style={{ textAlign: 'center' }}>
            {t('member.memoDelete.body', { count: photoCount })}
          </Text>

          <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 4 }}>
            <Button
              label={t('member.memoDelete.confirm')}
              variant="destructiveSolid"
              size="large"
              fullWidth
              onPress={onConfirm}
            />
            <Button
              label={t('member.memoDelete.cancel')}
              variant="neutral"
              size="large"
              fullWidth
              onPress={onCancel}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

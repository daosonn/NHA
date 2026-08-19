import { Pencil, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';

import type { MemoItem } from '../../fixtures/member';
import { colors, elevation, radius } from '../../theme';
import { Text } from '../ui/text';
import { CATEGORY_KEY } from './memo-card';

export type MemoActionsSheetProps = {
  /** The note being acted on. `null` closes the sheet. */
  memo: MemoItem | null;
  onClose: () => void;
  onEdit: (memo: MemoItem) => void;
  onDelete: (memo: MemoItem) => void;
};

/**
 * What you can do to a note, reached by the ⋯ button or a long press.
 *
 * A plain `Modal` rather than `@gorhom/bottom-sheet`, matching
 * `components/family/invite-sheet.tsx`: two rows and a cancel need no snap
 * points, and the dependency can be added the day something does.
 *
 * There is no "Share with family" row. A memo is private to whoever wrote it
 * (`docs/00-shared/domain-model.md`), so sharing one is not a feature that
 * exists to be greyed out — it is a feature that would contradict the model.
 */
export function MemoActionsSheet({ memo, onClose, onEdit, onDelete }: MemoActionsSheetProps) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={memo !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('member.memoActions.closeScrim')}
        style={{ flex: 1, backgroundColor: colors.state.scrim }}
      />

      {memo !== null && (
        <View
          style={[
            {
              borderTopLeftRadius: radius['7xl'],
              borderTopRightRadius: radius['7xl'],
              backgroundColor: colors.background.page,
              paddingTop: 10,
              paddingHorizontal: 20,
              paddingBottom: 26,
              gap: 14,
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

          <View style={{ gap: 2 }}>
            <Text variant="body1" weight="semibold" numberOfLines={1}>
              {memo.title}
            </Text>
            <Text variant="badge" color={colors.text.subtle}>
              {t('member.memoActions.meta', {
                category: t(CATEGORY_KEY[memo.category]),
                count: memo.photos.length,
              })}
            </Text>
          </View>

          <View
            style={{
              borderRadius: radius['2xl'],
              backgroundColor: colors.background.card,
              boxShadow: `inset 0 0 0 1px rgba(24,24,27,0.06)`,
            }}
          >
            <Pressable
              onPress={() => onEdit(memo)}
              accessibilityRole="button"
              style={{
                height: 54,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Pencil size={20} color={colors.text.secondary} strokeWidth={2} />
              <Text variant="body1" weight="medium" style={{ flex: 1 }}>
                {t('member.memoActions.edit')}
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => onDelete(memo)}
            accessibilityRole="button"
            style={{
              height: 54,
              paddingHorizontal: 16,
              borderRadius: radius['2xl'],
              backgroundColor: colors.background.card,
              boxShadow: `inset 0 0 0 1px rgba(240,112,95,0.28)`,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Trash2 size={20} color={colors.coral.deep} strokeWidth={2} />
            <Text variant="body1" weight="semibold" color={colors.coral.deep} style={{ flex: 1 }}>
              {t('member.memoActions.delete')}
            </Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={{
              height: 52,
              borderRadius: radius.full,
              backgroundColor: colors.background.subtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="body1" weight="semibold" color={colors.text.secondary}>
              {t('member.memoActions.cancel')}
            </Text>
          </Pressable>
        </View>
      )}
    </Modal>
  );
}

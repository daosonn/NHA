import { Pencil, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { MemoDetail } from '../../lib/api';
import { colors, elevation, radius } from '../../theme';
import { Button } from '../ui/button';
import { SheetModal } from '../ui/sheet-modal';
import { Text } from '../ui/text';
import { categoryLabel } from './memo-card';

export type MemoActionsSheetProps = {
  /** The note being acted on. `null` closes the sheet. */
  memo: MemoDetail | null;
  onClose: () => void;
  onEdit: (memo: MemoDetail) => void;
  onDelete: (memo: MemoDetail) => void;
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
 *
 * **Deleting confirms in here rather than in a second modal.** It used to
 * open `memo-delete-dialog.tsx` — mockup 1h — which meant asking React Native
 * to dismiss one `Modal` and present another on the same tick. The two
 * overlapped on screen. One surface, two states, no timing to get wrong; the
 * dialog's own weight is kept in the confirm step rather than lost.
 */
export function MemoActionsSheet({ memo, onClose, onEdit, onDelete }: MemoActionsSheetProps) {
  const { t } = useTranslation();

  const [confirming, setConfirming] = useState(false);

  // The sheet stays mounted between openings, so the second note must not
  // arrive already asking whether to delete the first.
  useEffect(() => {
    if (memo === null) setConfirming(false);
  }, [memo]);

  return (
    <SheetModal
      visible={memo !== null}
      onClose={onClose}
      scrimLabel={t('member.memoActions.closeScrim')}
    >
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
                category: categoryLabel(t, memo.category),
                count: memo.media.length,
              })}
            </Text>
          </View>

          {confirming ? (
            <View style={{ alignItems: 'center', gap: 12, paddingTop: 4 }}>
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

              {/* Says what goes with it. A memo's DELETE takes its media
                  files too, which is the opposite of the album rule and the
                  reason this one is worth confirming at all. */}
              <Text variant="body2" color={colors.text.muted} style={{ textAlign: 'center' }}>
                {t('member.memoDelete.body', { count: memo.media.length })}
              </Text>

              <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 4 }}>
                <Button
                  label={t('member.memoDelete.confirm')}
                  variant="destructiveSolid"
                  size="large"
                  fullWidth
                  onPress={() => onDelete(memo)}
                />
                <Button
                  label={t('member.memoDelete.cancel')}
                  variant="neutral"
                  size="large"
                  fullWidth
                  onPress={() => setConfirming(false)}
                />
              </View>
            </View>
          ) : (
            <>
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
                onPress={() => setConfirming(true)}
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
                <Text
                  variant="body1"
                  weight="semibold"
                  color={colors.coral.deep}
                  style={{ flex: 1 }}
                >
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
            </>
          )}
        </View>
      )}
    </SheetModal>
  );
}

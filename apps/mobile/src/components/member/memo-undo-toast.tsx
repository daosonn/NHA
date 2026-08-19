import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { clearDeleted, undoDelete, useDeleted } from '../../features/member/memo-store';
import { spacing } from '../../theme';
import { UndoToast } from '../ui/undo-toast';

export type MemoUndoToastProps = {
  memberId: string;
  /** Clearance for whatever sits at the bottom of the screen — usually the nav. */
  bottom?: number;
};

/**
 * The offer to put back the note that was just deleted.
 *
 * Rendered by the route rather than by `ProfileBody`, because it has to float
 * over the screen: inside the scroll view it would scroll away with the
 * content, which is the one thing a toast must not do.
 */
export function MemoUndoToast({ memberId, bottom = 34 }: MemoUndoToastProps) {
  const { t } = useTranslation();
  const deleted = useDeleted(memberId);

  if (deleted === null) return null;

  return (
    <View style={{ position: 'absolute', left: spacing.xl, right: spacing.xl, bottom }}>
      <UndoToast
        visible
        message={t('member.memoDelete.done')}
        actionLabel={t('member.memoDelete.undo')}
        onUndo={undoDelete}
        onDismiss={clearDeleted}
      />
    </View>
  );
}

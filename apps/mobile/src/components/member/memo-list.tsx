import { Lock, NotebookPen, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { MemoItem } from '../../fixtures/member';
import { colors, radius } from '../../theme';
import { EmptyState } from '../ui/empty-state';
import { Text } from '../ui/text';
import { MemoCard } from './memo-card';

const GRID_GAP = 10;

/** The dashed tile that opens an empty editor. Always first in the grid. */
function AddCard({ onPress }: { onPress?: () => void }) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('member.memoEmptyAction')}
      style={{
        minHeight: 110,
        borderRadius: radius['3xl'],
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.state.disabledBorder,
        backgroundColor: colors.background.surfaceSoft,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.full,
          backgroundColor: colors.background.muted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={20} color={colors.text.lightMuted} strokeWidth={2} />
      </View>

      <Text variant="body2" weight="medium" color={colors.text.lightMuted}>
        {t('member.memoEmptyAction')}
      </Text>
    </Pressable>
  );
}

export type MemoListProps = {
  memos: MemoItem[];
  memberName: string;
  onAddMemo?: () => void;
  onOpenMemo?: (memo: MemoItem) => void;
  onMemoActions?: (memo: MemoItem) => void;
};

/**
 * Private notes *about* this person, written by the viewer.
 *
 * `Memo.ownerUserId` is the author and only they can ever read these — the
 * person the note is about cannot. That is easy to forget and expensive to
 * get wrong, so the screen says it out loud instead of relying on the user
 * remembering the rule.
 *
 * Two columns rather than one list: notes are short and unequal, and a single
 * column of stubby cards wastes half the width of the screen. The split is by
 * index, not by measured height — a masonry that reflows as you scroll costs
 * more than the slightly uneven column bottoms it fixes.
 */
export function MemoList({
  memos,
  memberName,
  onAddMemo,
  onOpenMemo,
  onMemoActions,
}: MemoListProps) {
  const { t } = useTranslation();

  if (memos.length === 0) {
    return (
      <EmptyState
        renderIcon={(props) => <NotebookPen {...props} strokeWidth={2} />}
        title={t('member.memoEmpty')}
        description={t('member.memoEmptyBody', { name: memberName })}
        actionLabel={t('member.memoEmptyAction')}
        onActionPress={onAddMemo}
      />
    );
  }

  const columns: MemoItem[][] = [[], []];
  memos.forEach((memo, index) => columns[index % 2]?.push(memo));

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
          {t('member.memoHeading', { name: memberName })}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Lock size={13} color={colors.text.muted} strokeWidth={2} />
          <Text variant="caption" color={colors.text.muted} style={{ flex: 1 }}>
            {t('member.memoPrivate', { name: memberName })}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: GRID_GAP }}>
        {columns.map((column, index) => (
          <View key={index} style={{ flex: 1, gap: GRID_GAP }}>
            {index === 0 && <AddCard onPress={onAddMemo} />}

            {column.map((memo) => (
              <MemoCard
                key={memo.id}
                memo={memo}
                onPress={() => onOpenMemo?.(memo)}
                onLongPress={() => onMemoActions?.(memo)}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

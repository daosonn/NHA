import { Lock, NotebookPen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors, radius } from '../../theme';
import type { MemoCategory, MemoItem } from '../../fixtures/member';
import { formatFullDate } from '../../lib/date';
import { Card } from '../ui/card';
import { Chip } from '../ui/chip';
import { EmptyState } from '../ui/empty-state';
import { Text } from '../ui/text';

/** What each category is *for*, said in the reader's words. */
const CATEGORY_KEY: Record<MemoCategory, string> = {
  hobbies: 'member.memoCategories.hobbies',
  health: 'member.memoCategories.health',
  gift: 'member.memoCategories.gift',
  memories: 'member.memoCategories.memories',
  todo: 'member.memoCategories.todo',
};

export type MemoListProps = {
  memos: MemoItem[];
  memberName: string;
  onAddMemo?: () => void;
};

/**
 * Private notes *about* this person, written by the viewer.
 *
 * `Memo.ownerUserId` is the author and only they can ever read these — the
 * person the note is about cannot. That is easy to forget and expensive to
 * get wrong, so the screen says it out loud instead of relying on the user
 * remembering the rule.
 */
export function MemoList({ memos, memberName, onAddMemo }: MemoListProps) {
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

  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: radius.md,
          backgroundColor: colors.background.subtle,
        }}
      >
        <Lock size={13} color={colors.text.muted} strokeWidth={2} />
        <Text variant="caption" color={colors.text.muted} style={{ flex: 1 }}>
          {t('member.memoPrivate', { name: memberName })}
        </Text>
      </View>

      {memos.map((memo) => {
        const updated = formatFullDate(memo.updatedAt);

        return (
          <Card key={memo.id} padding={14} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Chip label={t(CATEGORY_KEY[memo.category])} theme={memo.category} showDot />

              {updated !== null && (
                <Text variant="badge" color={colors.text.lightMuted}>
                  {updated}
                </Text>
              )}
            </View>

            <Text variant="body2" color={colors.text.secondary}>
              {memo.content}
            </Text>
          </Card>
        );
      })}
    </View>
  );
}

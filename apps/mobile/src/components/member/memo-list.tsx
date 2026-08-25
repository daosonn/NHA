import { Lock, NotebookPen, Plus, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import type { MemoDetail } from '../../lib/api';
import { colors, radius } from '../../theme';
import { Avatar } from '../ui/avatar';
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
        // Mockup 1c: a slightly firmer dash than a disabled border, so the
        // tile reads as an invitation rather than as something switched off.
        borderColor: colors.state.borderDashed,
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
  memos: MemoDetail[];
  memberName: string;
  /**
   * True trên hồ sơ của CHÍNH BẠN: danh sách là toàn bộ sổ tay, gồm ghi chú về
   * nhiều người, nên nó được NHÓM THEO NGƯỜI (kèm ảnh) và không có ô "viết ghi
   * chú" — ở đây chưa biết viết về người nào (mở hồ sơ người đó rồi viết).
   */
  own?: boolean;
  /** Ảnh cho tiêu đề mỗi nhóm. Thiếu thì nhóm vẫn hiện, chỉ là chữ viết tắt. */
  people?: { memberId: string; displayName: string; avatarKey: string | null }[];
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  onAddMemo?: () => void;
  onOpenMemo?: (memo: MemoDetail) => void;
  onMemoActions?: (memo: MemoDetail) => void;
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
  own = false,
  people,
  loading = false,
  failed = false,
  onRetry,
  onAddMemo,
  onOpenMemo,
  onMemoActions,
}: MemoListProps) {
  const { t } = useTranslation();

  /** Người đang được lọc; null = xem tất cả. */
  const [picked, setPicked] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={{ paddingVertical: 40, alignItems: 'center' }}>
        <ActivityIndicator color={colors.coral.primary} />
      </View>
    );
  }

  if (failed) {
    return (
      <EmptyState
        renderIcon={(props) => <TriangleAlert {...props} strokeWidth={2} />}
        title={t('member.memoFailed')}
        actionLabel={t('home.retry')}
        onActionPress={onRetry}
      />
    );
  }

  if (memos.length === 0) {
    return (
      <EmptyState
        renderIcon={(props) => <NotebookPen {...props} strokeWidth={2} />}
        title={t('member.memoEmpty')}
        description={
          own ? t('member.memoOwnEmptyBody') : t('member.memoEmptyBody', { name: memberName })
        }
        // Trên hồ sơ của mình không đề nghị "viết ghi chú": chưa biết viết về ai
        actionLabel={own ? undefined : t('member.memoEmptyAction')}
        onActionPress={own ? undefined : onAddMemo}
      />
    );
  }

  /**
   * The Add tile is the first *item*, not an extra stuck on top of the left
   * column. Counting it into the alternation is what keeps the two sides even:
   * bolting it on gave the left column one more card than the right every
   * time, and with a single note the right column was empty altogether — the
   * whole grid leaned. Mockup 1c alternates the same way.
   */
  const cells: ({ kind: 'add' } | { kind: 'memo'; memo: MemoDetail })[] = [
    ...(own ? [] : [{ kind: 'add' as const }]),
    ...memos.map((memo) => ({ kind: 'memo' as const, memo })),
  ];

  const columns: (typeof cells)[] = [[], []];
  cells.forEach((cell, index) => columns[index % 2]?.push(cell));

  const groups = own ? groupByPerson(memos, people) : [];
  const shown = picked === null ? groups : groups.filter((g) => g.key === picked);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text variant="subtitle" weight="bold" style={{ letterSpacing: -0.2 }}>
          {own ? t('member.memoOwnHeading') : t('member.memoHeading', { name: memberName })}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Lock size={13} color={colors.text.muted} strokeWidth={2} />
          <Text variant="caption" color={colors.text.muted} style={{ flex: 1 }}>
            {own ? t('member.memoOwnPrivate') : t('member.memoPrivate', { name: memberName })}
          </Text>
        </View>
      </View>

      {own ? (
        <>
          {/* Chọn người để lọc. Sổ tay dài thì "ghi chú về ông đâu rồi" là câu
              hỏi thường nhất — dải này trả lời bằng một lần chạm. */}
          {groups.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
            >
              <FilterChip
                label={t('member.memoFilterAll')}
                count={memos.length}
                active={picked === null}
                onPress={() => setPicked(null)}
              />
              {groups.map((g) => (
                <FilterChip
                  key={g.key}
                  label={g.displayName}
                  count={g.memos.length}
                  avatarId={g.avatarKey}
                  active={picked === g.key}
                  onPress={() => setPicked(picked === g.key ? null : g.key)}
                />
              ))}
            </ScrollView>
          )}

          {/* Xếp theo NGƯỜI. Một danh sách trộn lẫn thì phải đọc từng thẻ mới
              biết nó nói về ai; theo nhóm thì chỉ cần nhìn xuống một khối. */}
          {shown.map((group) => (
            <View key={group.key} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <Avatar size={28} name={group.displayName} mediaId={group.avatarKey} />
                <Text variant="body2" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
                  {group.displayName}
                </Text>
                <Text variant="caption" color={colors.text.lightMuted}>
                  {t('member.memoGroupCount', { count: group.memos.length })}
                </Text>
              </View>

              <MemoGrid memos={group.memos} onOpenMemo={onOpenMemo} onMemoActions={onMemoActions} />
            </View>
          ))}
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: GRID_GAP }}>
          {columns.map((column, index) => (
            <View key={index} style={{ flex: 1, gap: GRID_GAP }}>
              {column.map((cell) =>
                cell.kind === 'add' ? (
                  <AddCard key="add" onPress={onAddMemo} />
                ) : (
                  <MemoCard
                    key={cell.memo.id}
                    memo={cell.memo}
                    onPress={() => onOpenMemo?.(cell.memo)}
                    onLongPress={() => onMemoActions?.(cell.memo)}
                  />
                ),
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Một người trong dải lọc: ảnh, tên, số ghi chú. */
function FilterChip({
  label,
  count,
  avatarId,
  active,
  onPress,
}: {
  label: string;
  count: number;
  avatarId?: string | null;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingLeft: avatarId === undefined ? 12 : 5,
        paddingRight: 12,
        paddingVertical: 5,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: active ? colors.coral.primary : colors.state.borderDefault,
        backgroundColor: active ? colors.coral.soft : colors.background.card,
      }}
    >
      {avatarId !== undefined && <Avatar size={24} name={label} mediaId={avatarId} />}
      <Text
        variant="caption"
        weight="semibold"
        color={active ? colors.coral.deep : colors.text.secondary}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text variant="badge" color={active ? colors.coral.deep : colors.text.lightMuted}>
        {count}
      </Text>
    </Pressable>
  );
}

/** Hai cột thẻ, không có ô "thêm" — dùng trong từng nhóm người. */
function MemoGrid({
  memos,
  onOpenMemo,
  onMemoActions,
}: Pick<MemoListProps, 'memos' | 'onOpenMemo' | 'onMemoActions'>) {
  const columns: MemoDetail[][] = [[], []];
  memos.forEach((memo, index) => columns[index % 2]?.push(memo));

  return (
    <View style={{ flexDirection: 'row', gap: GRID_GAP }}>
      {columns.map((column, index) => (
        <View key={index} style={{ flex: 1, gap: GRID_GAP }}>
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
  );
}

/**
 * Ghi chú xếp theo người, người nào có nhiều ghi chú lên trước.
 *
 * `aboutName` là ảnh chụp tên lúc viết, nên ghi chú về người đã rời gia đình
 * vẫn có nhóm riêng đọc được — chỉ là không có ảnh để vẽ.
 */
function groupByPerson(
  memos: MemoDetail[],
  people: MemoListProps['people'],
): { key: string; displayName: string; avatarKey: string | null; memos: MemoDetail[] }[] {
  const groups = new Map<string, { displayName: string; memos: MemoDetail[] }>();

  for (const memo of memos) {
    const key = memo.aboutMemberId ?? `gone:${memo.aboutName}`;
    const found = groups.get(key);
    if (found) found.memos.push(memo);
    else groups.set(key, { displayName: memo.aboutName, memos: [memo] });
  }

  return [...groups.entries()]
    .map(([key, value]) => ({
      key,
      displayName: value.displayName,
      avatarKey: people?.find((p) => p.memberId === key)?.avatarKey ?? null,
      memos: value.memos,
    }))
    .sort((a, b) => b.memos.length - a.memos.length || a.displayName.localeCompare(b.displayName));
}

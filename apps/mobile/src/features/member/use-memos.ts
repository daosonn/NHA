import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DraftMedia } from '../../components/moment/media-strip';
import { memos } from '../../lib/api';
import type { MemoDetail, UpdateMemoRequest } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { uploadDrafts } from '../moment/upload-drafts';

/**
 * The notes the viewer wrote about one member.
 *
 * Author-only, always: the server returns nobody else's, so there is no
 * filtering to do here and nothing to hide on screen — the list is already
 * only yours (`docs/00-shared/api-contract.md` → Memos).
 *
 * Server order is most-recently-touched first, and it is left alone. Sorting
 * again on the client would only be a second opinion that drifts.
 */
export function useMemberMemos(familyId: string | null, memberId: string | null) {
  return useQuery({
    queryKey: queryKeys.memberMemos(familyId ?? '', memberId ?? ''),
    queryFn: () => memos.forMember(familyId as string, memberId as string),
    enabled: familyId !== null && memberId !== null,
  });
}

/**
 * Mọi ghi chú bạn từng viết, về bất kỳ ai.
 *
 * Dùng cho tab メモ trên hồ sơ CỦA CHÍNH BẠN. Ở đó danh sách "ghi chú về người
 * này" luôn rỗng — không ai viết ghi chú về bản thân — nên trước đây tab ấy chỉ
 * hiện trạng thái trống dù sổ tay có cả chục cái. Hồ sơ của bạn là nơi hợp lý
 * để thấy toàn bộ sổ, kể cả ghi chú về người đã rời gia đình.
 */
export function useMyMemos(enabled = true) {
  return useQuery({
    queryKey: queryKeys.myMemos(),
    queryFn: () => memos.mine(),
    enabled,
  });
}

/** One note by id. Works for an orphaned note, whose member route is gone. */
export function useMemo(memoId: string | null) {
  return useQuery({
    queryKey: queryKeys.memo(memoId ?? ''),
    queryFn: () => memos.detail(memoId as string),
    enabled: memoId !== null,
  });
}

export type CreateMemoInput = {
  title: string;
  content?: string;
  category?: string;
  /** Picked files. Uploaded first — attachments are fixed at creation. */
  media: DraftMedia[];
};

export function useCreateMemo(familyId: string | null, memberId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, content, category, media }: CreateMemoInput) => {
      if (familyId === null || memberId === null) throw new Error('No member to write about');

      const mediaIds = await uploadDrafts(media);

      return memos.create(familyId, memberId, {
        title,
        content,
        category,
        mediaIds: mediaIds.length === 0 ? undefined : mediaIds,
      });
    },
    onSuccess: (memo) => {
      queryClient.setQueryData(queryKeys.memo(memo.id), memo);
      if (familyId === null || memberId === null) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.memberMemos(familyId, memberId) });
    },
  });
}

export function useUpdateMemo(memoId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateMemoRequest) => {
      if (memoId === null) throw new Error('No memo to update');
      return memos.update(memoId, body);
    },
    onSuccess: (memo) => {
      queryClient.setQueryData(queryKeys.memo(memo.id), memo);
      invalidateMemberList(queryClient, memo);
    },
  });
}

/**
 * Removes a note for good.
 *
 * There is no undo. The screen used to offer one because the notes lived in
 * memory and putting one back cost nothing; a real `DELETE` takes the row and
 * its media files with it, and the only honest "undo" would be writing a new
 * note that has lost its photos. The confirmation dialog carries the weight
 * instead — it names the photo count and says the note is gone for good.
 */
export function useDeleteMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memo: MemoDetail) => memos.remove(memo.id),
    onSuccess: (_result, memo) => {
      queryClient.removeQueries({ queryKey: queryKeys.memo(memo.id) });
      invalidateMemberList(queryClient, memo);
    },
  });
}

/**
 * The list a memo belongs to, refreshed after it changed.
 *
 * `aboutMemberId` is null for an orphaned note — its member is gone, so there
 * is no list to refresh and every family's memo list is left alone rather
 * than blanket-invalidated.
 */
function invalidateMemberList(
  queryClient: ReturnType<typeof useQueryClient>,
  memo: MemoDetail,
): void {
  if (memo.aboutMemberId === null) return;
  void queryClient.invalidateQueries({
    predicate: ({ queryKey }) =>
      queryKey[0] === 'families' &&
      queryKey[2] === 'members' &&
      queryKey[3] === memo.aboutMemberId &&
      queryKey[4] === 'memos',
  });
}

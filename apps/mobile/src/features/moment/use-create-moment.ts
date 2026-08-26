import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { DraftMedia } from '../../components/moment/media-strip';
import { posts } from '../../lib/api';
import type { PostDetail } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { uploadDrafts } from './upload-drafts';

export type CreateMomentInput = {
  content: string;
  media: DraftMedia[];
  /** Empty means private to the author — not "everyone" (`api-contract.md`). */
  familyIds: string[];
  /**
   * Who is in the moment, as `FamilyMember.id`s. This is what fills the
   * Album on each of their Life Profiles; empty means the moment reaches the
   * feed and nobody's page. The server refuses an id outside `familyIds`.
   */
  taggedMemberIds: string[];
};

/**
 * Upload the files, then post — in that order, because attachments are fixed
 * at creation and `mediaIds` cannot be added later. The upload itself is
 * `uploadDrafts`, shared with everything else that carries media.
 */
export function useCreateMoment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      content,
      media,
      familyIds,
      taggedMemberIds,
    }: CreateMomentInput): Promise<PostDetail> => {
      const mediaIds = await uploadDrafts(media);

      return posts.create({
        type: 'POST',
        content: content.trim() === '' ? undefined : content.trim(),
        familyIds,
        taggedMemberIds: taggedMemberIds.length === 0 ? undefined : taggedMemberIds,
        mediaIds: mediaIds.length === 0 ? undefined : mediaIds,
      });
    },

    onSuccess: (post) => {
      // Dòng chung của Home gộp mọi nhà → bài mới tới bất kỳ nhà nào cũng làm
      // nó stale. (Bài riêng tư không vào feed nào, invalidate cũng vô hại.)
      void queryClient.invalidateQueries({ queryKey: queryKeys.myFeed() });

      // Only the families this post actually reached have a stale feed. A
      // private post reaches none, and invalidating everything would refetch
      // feeds that cannot have changed.
      for (const familyId of post.familyIds) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.familyFeed(familyId) });

        // Every Album under this family is built by scanning that same feed,
        // so they go stale with it — including the pages of people who were
        // just tagged. Invalidating the family subtree is blunt but right:
        // the alternative is listing member ids the screen does not have.
        void queryClient.invalidateQueries({ queryKey: queryKeys.family(familyId) });
      }
    },
  });
}

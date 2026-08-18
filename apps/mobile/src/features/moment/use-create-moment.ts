import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { DraftMedia } from '../../components/moment/media-strip';
import { media as mediaApi, posts } from '../../lib/api';
import type { PostDetail } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

export type CreateMomentInput = {
  content: string;
  media: DraftMedia[];
  /** Empty means private to the author — not "everyone" (`api-contract.md`). */
  familyIds: string[];
};

/**
 * Upload the files, then post — in that order, because attachments are fixed
 * at creation and `mediaIds` cannot be added later.
 *
 * Uploads run **one at a time**. A moment can carry a dozen photos and the
 * ceiling is 100MB each; firing them all at once on a phone's connection
 * makes every one of them slower and turns a partial failure into a puzzle.
 * Sequential also means the first failure stops the rest, so nothing is left
 * orphaned on the server beyond what was already sent.
 */
export function useCreateMoment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, media, familyIds }: CreateMomentInput): Promise<PostDetail> => {
      const mediaIds: string[] = [];

      for (const item of media) {
        if (item.uri === undefined) continue;

        const uploaded = await mediaApi.upload({
          uri: item.uri,
          name: item.fileName ?? `${item.id}.jpg`,
          type: item.mimeType ?? 'image/jpeg',
        });

        mediaIds.push(uploaded.id);
      }

      return posts.create({
        type: 'POST',
        content: content.trim() === '' ? undefined : content.trim(),
        familyIds,
        mediaIds: mediaIds.length === 0 ? undefined : mediaIds,
      });
    },

    onSuccess: (post) => {
      // Only the families this post actually reached have a stale feed. A
      // private post reaches none, and invalidating everything would refetch
      // feeds that cannot have changed.
      for (const familyId of post.familyIds) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.familyFeed(familyId) });
      }
    },
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { DraftMedia } from '../../components/moment/media-strip';
import { lifeEvents } from '../../lib/api';
import type { CreateLifeEventRequest, UpdateLifeEventRequest } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { uploadDrafts } from '../moment/upload-drafts';

/** Everything one "Done" tap owes the server, in one bag. */
export type TimelineCommit = {
  /**
   * New entries carry their picked files, still local: nothing is uploaded
   * until Done, keeping the editor's "only visible to you" promise all the
   * way down — an abandoned draft leaves no orphan uploads behind.
   */
  creates: { body: CreateLifeEventRequest; media: DraftMedia[] }[];
  updates: { id: string; body: UpdateLifeEventRequest }[];
  removes: string[];
};

/**
 * Commits a staged timeline edit — the edit-timeline screen's "Done".
 *
 * The screen edits a local draft ("changes are only visible to you until
 * Done"), so the server hears nothing until this runs, and then hears the
 * whole session at once. Sequential rather than parallel: the server writes
 * EditHistory per change, the list is family-sized, and a failure mid-way is
 * easier to reason about when the order is fixed — removes first (they can
 * free a year an edit moves into), then edits, then additions.
 *
 * A partial failure leaves the server half-way through the batch, so the
 * cache is invalidated on settle, not just success — the screen reseeds
 * from what actually landed and the person tries Done again with the rest.
 */
export function useCommitMyTimeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commit: TimelineCommit) => {
      for (const id of commit.removes) {
        await lifeEvents.removeMine(id);
      }
      for (const update of commit.updates) {
        await lifeEvents.updateMine(update.id, update.body);
      }
      for (const create of commit.creates) {
        // Files first — attachments are fixed at creation, so `mediaIds`
        // cannot be added to the entry later (`uploadDrafts`, the same
        // upload every media-carrying feature shares).
        const mediaIds = await uploadDrafts(create.media);
        await lifeEvents.createMine({
          ...create.body,
          ...(mediaIds.length === 0 ? {} : { mediaIds }),
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myLifeEvents() });
    },
  });
}

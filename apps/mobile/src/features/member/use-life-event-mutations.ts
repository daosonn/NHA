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
  /**
   * `media` is the whole set the entry should END UP with — tiles already on
   * the server (they carry `mediaId`) beside files just picked. The kept ids
   * and the ids the uploads come back with are spliced into `mediaIds` here,
   * because the caller cannot know the second half until the upload returns.
   */
  updates: { id: string; body: UpdateLifeEventRequest; media: DraftMedia[] }[];
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
 *
 * Since 2026-09-03 an update can change the entry's photos too, which is why
 * uploads happen in this loop as well as the create one. Removing a saved
 * photo DELETES it, file included — the server does that when its id is
 * missing from `mediaIds` — so the confirmation for it belongs on the screen,
 * before Done, not here.
 */
export function useCommitMyTimeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commit: TimelineCommit) => {
      for (const id of commit.removes) {
        await lifeEvents.removeMine(id);
      }
      for (const update of commit.updates) {
        // Kept photos keep their ids; picks become ids by being uploaded.
        // `uploadDrafts` skips anything with no `uri`, so the saved tiles
        // pass straight through it without a second trip.
        const kept = update.media
          .map((item) => item.mediaId)
          .filter((id): id is string => id !== undefined);
        const uploaded = await uploadDrafts(update.media);
        await lifeEvents.updateMine(update.id, {
          ...update.body,
          // Always sent, never omitted: the server treats an omitted
          // `mediaIds` as "leave the photos alone", so a removal has to
          // arrive as the shorter array. Sending an unchanged set is free —
          // the server compares it and writes nothing.
          mediaIds: [...kept, ...uploaded],
        });
      }
      for (const create of commit.creates) {
        // Files first: an entry cannot name media that does not exist yet.
        // `uploadDrafts` is the same upload every media-carrying feature
        // shares.
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

import type { DraftMedia } from '../../components/moment/media-strip';
import { media as mediaApi } from '../../lib/api';

/**
 * Uploads picked files and hands back their ids, ready to attach.
 *
 * Attachments are fixed at creation everywhere in this API — posts, life
 * events, memos — so the files always have to exist before the thing that
 * carries them. This is that step, shared by everything that carries media.
 *
 * Uploads run **one at a time**. A moment can carry a dozen photos and the
 * ceiling is 100MB each; firing them all at once on a phone's connection
 * makes every one of them slower and turns a partial failure into a puzzle.
 * Sequential also means the first failure stops the rest, so nothing is left
 * orphaned on the server beyond what was already sent.
 *
 * Tiles with no `uri` are skipped: they are striped placeholders standing in
 * for media that already exists somewhere, not files waiting to be sent.
 */
export async function uploadDrafts(drafts: DraftMedia[]): Promise<string[]> {
  const ids: string[] = [];

  for (const item of drafts) {
    if (item.uri === undefined) continue;

    const uploaded = await mediaApi.upload({
      uri: item.uri,
      name: item.fileName ?? `${item.id}.jpg`,
      type: item.mimeType ?? 'image/jpeg',
    });

    ids.push(uploaded.id);
  }

  return ids;
}

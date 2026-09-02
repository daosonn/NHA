import type { PostDetail } from '../../lib/api';

export type PhotoTile = {
  /** `Media.id` — what the grid renders and what the source helper needs. */
  id: string;
  mimeType: string;
  /** The post it came from, so a tap can open the moment it belongs to. */
  postId: string;
};

export type PhotoDay = {
  /** `YYYY-MM-DD`, and the section key. */
  date: string;
  /** Where it happened, when the moments that day agree on a place. */
  place: string | null;
  count: number;
  /** Rows of four, because the grid draws four across. */
  rows: PhotoTile[][];
};

const COLUMNS = 3; // mockup 13a: ba cột, ô to hơn — trước là 4 (mockup 10b)

/**
 * Posts in, rows of tiles out.
 *
 * Kept apart from the hook because it is the part with rules in it — which
 * day a photo belongs to, when a place may be shown, how a short row is
 * padded — and rules deserve to be runnable without React. Verified against
 * a real family's feed on 2026-08-18.
 *
 * Grouping is by **posted** date rather than by the day the photo was taken:
 * the server returns no capture metadata, and inventing an order the data
 * cannot support would file photos under the wrong heading.
 */
export function groupByDay(posts: PostDetail[]): PhotoDay[] {
  const byDate = new Map<string, { tiles: PhotoTile[]; places: string[] }>();

  for (const post of posts) {
    if (post.media.length === 0) continue;

    const date = post.createdAt.slice(0, 10);
    const bucket = byDate.get(date) ?? { tiles: [], places: [] };

    for (const item of post.media) {
      bucket.tiles.push({ id: item.id, mimeType: item.mimeType, postId: post.id });
    }
    if (post.place !== null && post.place !== '') bucket.places.push(post.place);

    byDate.set(date, bucket);
  }

  return (
    [...byDate.entries()]
      // The feed is newest-first, but a Map preserves insertion order rather
      // than date order once pages arrive out of sequence.
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, { tiles, places }]) => ({
        date,
        // One place only when the day speaks with one voice; two different
        // places under one heading would be a claim the data cannot support.
        place: places.length > 0 && places.every((p) => p === places[0]) ? places[0] : null,
        count: tiles.length,
        rows: chunk(tiles, COLUMNS),
      }))
  );
}

function chunk(tiles: PhotoTile[], size: number): PhotoTile[][] {
  const rows: PhotoTile[][] = [];
  for (let i = 0; i < tiles.length; i += size) rows.push(tiles.slice(i, i + size));
  return rows;
}

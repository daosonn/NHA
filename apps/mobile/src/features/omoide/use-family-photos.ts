import { useMemo } from 'react';

import { useFamilyFeed } from '../feed/use-family-feed';
import { groupByDay } from './group-photos';

export type { PhotoDay, PhotoTile } from './group-photos';

/**
 * Every photo and video the family has shared, newest day first.
 *
 * The MVP Omoide is deliberately not an album system (decided 2026-08-18):
 * it is the family feed with the words taken away and the pictures grouped
 * by day. That needs no new endpoint — `GET /families/:id/posts` already
 * returns each post with its media, and already excludes private posts,
 * which is exactly the boundary a shared memory shelf should have.
 */
export function useFamilyPhotos(familyId: string | null) {
  const feed = useFamilyFeed(familyId);

  const posts = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);

  const days = useMemo(() => groupByDay(posts), [posts]);
  const total = useMemo(() => days.reduce((sum, day) => sum + day.count, 0), [days]);

  // Counted over posts that actually carried media: somebody who only ever
  // wrote text has not contributed to the shelf.
  const contributors = useMemo(
    () => new Set(posts.filter((p) => p.media.length > 0).map((p) => p.authorUserId)).size,
    [posts],
  );

  return { ...feed, days, total, contributors };
}

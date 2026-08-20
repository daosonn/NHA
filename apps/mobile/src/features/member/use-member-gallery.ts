import { useQuery } from '@tanstack/react-query';

import { gallery } from '../../lib/api';
import type { GalleryMediaItem } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/**
 * One thing that happened, and the files it left behind.
 *
 * The endpoint returns loose media newest-first; a moment is what the family
 * actually remembers, so the files are put back together by the row they hang
 * off. `postId` and `lifeEventId` are on every item for exactly this.
 */
export type GalleryGroup = {
  /** Stable across refetches — the post, the event, or the lone file's own id. */
  key: string;
  kind: 'post' | 'event' | 'loose';
  /** Set only for `post`, and only then is there somewhere to open. */
  postId: string | null;
  media: GalleryMediaItem[];
};

export type MemberGallery = {
  groups: GalleryGroup[];
  photoCount: number;
};

/**
 * Grouped in arrival order, so the newest moment stays first.
 *
 * A `Map` rather than a sort: the server has already ordered the media, and
 * re-sorting the groups by their own dates would be a second opinion that
 * drifts from the first the moment a post is edited.
 */
function group(items: GalleryMediaItem[]): MemberGallery {
  const groups = new Map<string, GalleryGroup>();

  for (const item of items) {
    // Exactly one of the two is set. The third case is defensive: a file with
    // neither is still somebody's photograph and must not vanish from their
    // page because it did not fit the shape.
    const key = item.postId ?? item.lifeEventId ?? item.id;
    const kind: GalleryGroup['kind'] =
      item.postId !== null ? 'post' : item.lifeEventId !== null ? 'event' : 'loose';

    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { key, kind, postId: item.postId, media: [item] });
    } else {
      existing.media.push(item);
    }
  }

  return { groups: [...groups.values()], photoCount: items.length };
}

/**
 * The Album tab: every photograph that belongs to one person.
 *
 * **Derived, not curated** — the server assembles it from the posts they
 * authored or were tagged in plus their life-event media, and filters it to
 * what the viewer may see. The `Album` model in the schema is a private,
 * user-curated collection and is a different thing entirely.
 *
 * Two routes, same rows, and which applies is not a preference: `/me/gallery`
 * is the only one that works before you belong to a family, and the member
 * route is the only one that can read somebody else. The caller says which
 * person this is; the hook picks.
 *
 * This replaced a client-side scan of the family feed (2026-08-19). That scan
 * read a bounded slice and said so on screen, could not see life-event media
 * at all, and re-derived a visibility rule that was never the client's to
 * decide. One request now does all three properly.
 */
export function useMemberGallery(options: {
  /** True when this is the signed-in account's own profile. */
  own: boolean;
  familyId: string | null;
  memberId: string | null;
}) {
  const { own, familyId, memberId } = options;

  const memberScoped = familyId !== null && memberId !== null;

  return useQuery({
    queryKey: own ? queryKeys.myGallery() : queryKeys.memberGallery(familyId ?? '', memberId ?? ''),
    queryFn: async () =>
      group(
        own
          ? await gallery.mine()
          : await gallery.forMember(familyId as string, memberId as string),
      ),
    enabled: own || memberScoped,
  });
}

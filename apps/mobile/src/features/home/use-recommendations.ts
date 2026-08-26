import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { AlbumSummary, PostDetail } from '../../lib/api';
import { dayOnly } from '../../lib/date';

/** Nothing younger than this counts as a look back. */
const LOOK_BACK_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Finished words, not catalogue keys.
 *
 * Deliberate, and the opposite of what `MemberProfile.relation` did: a month
 * name has to be looked up before it can go inside a sentence, so a tile that
 * carried keys would need the component to translate a value *inside* a
 * value. That shape is exactly what printed `family.relation.parent` under
 * somebody's name. The hook has `t`; it finishes the job.
 */
/** Where a tile goes when it is tapped — it is a way back in, not a picture. */
export type RecommendationTarget = { kind: 'post'; id: string } | { kind: 'album'; id: string };

export type RecommendationTile = {
  target: RecommendationTarget;
  /** Cover photograph — the grid picks stream vs poster frame by `mimeType`. */
  mediaId: string;
  /**
   * Vì sao phải mang theo: một moment có thể chỉ có CLIP, và bytes video nhét
   * vào <Image> không decode được — ô "A look back" từng trắng tinh vì đúng
   * chuyện này. Biết mime thì grid xin poster frame thay vì stream gốc.
   */
  mimeType: string;
  title: string;
  meta?: string;
};

/** A moment's own date when it has one, otherwise when it was posted. */
function momentDate(post: PostDetail): { year: number; month: number; day: number } | null {
  const raw = post.eventDate ?? post.createdAt;
  const [year, month, day] = dayOnly(raw).split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return { year, month, day };
}

/**
 * Today, as a whole number of days.
 *
 * This is the seed, and using the *day* rather than `Math.random()` is the
 * whole trick. A fresh random number every render would reshuffle the tiles
 * as the feed refetched, as the screen refocused, as anything above it
 * re-rendered — the shelf would flicker under the reader's thumb and they
 * could never go back to something they just saw. Keyed to the date it is
 * steady all day and different tomorrow, which is what "resurfaced" means on
 * every app that does this well.
 */
function daySeed(now: Date): number {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

/** A stable pick, not a shuffle: same seed and same list, same answer. */
function pick<T>(items: T[], seed: number): T | undefined {
  if (items.length === 0) return undefined;
  return items[((seed % items.length) + items.length) % items.length];
}

type Dated = { post: PostDetail; at: { year: number; month: number; day: number } };

/**
 * "Look what turned up" for the Home shelf, derived from the family's own
 * feed rather than stored anywhere.
 *
 * There is no recommendations endpoint and none is planned, so this used to
 * be three hard-coded titles over three bundled photographs — the same three
 * every day, for every family, opening nothing. What a social feed actually
 * does is not random either: it resurfaces **your** things on an anniversary
 * or from a busy stretch. That is derivable from what Home already has open.
 *
 * Two sources, both of them the family's own photographs: the shared feed,
 * and the viewer's personal albums.
 *
 * Four rules, in order, each skipping anything an earlier one took:
 *
 * 1. **On this day** — the same date in an earlier year. The one everybody
 *    recognises, and the reason the whole feature exists.
 * 2. **A month that was busy** — the earlier month with the most photographs.
 * 3. **From an album** — one shelf the viewer built, by the day seed. Album
 *    items carry only the date they were *filed*, not when the photograph was
 *    taken, so an album can never answer rules 1 or 2; it gets its own.
 * 4. **A look back** — one older moment, chosen by the day seed above.
 *
 * Nearly free: the feed is the query Home already loaded for the post list,
 * and `AlbumSummary` carries a cover and a count, so no album has to be
 * opened to draw a tile for it.
 */
export function useRecommendations(
  posts: PostDetail[],
  albums: AlbumSummary[] = [],
  now: Date = new Date(),
) {
  const { t } = useTranslation();

  return useMemo<RecommendationTile[]>(() => {
    const seed = daySeed(now);
    const today = { month: now.getMonth() + 1, day: now.getDate(), year: now.getFullYear() };

    // Only moments with something to look at, and only ones old enough to
    // feel like a memory rather than a repeat of what is directly below.
    //
    // Judged on **when the moment happened**, not when it was uploaded. The
    // two are the same for a photograph taken this morning and nothing alike
    // for a box of old family pictures scanned in one afternoon — and that
    // second case is precisely what a shelf like this exists for. Filtering
    // on `createdAt` threw all of them away on the day they arrived.
    const cutoff =
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - LOOK_BACK_DAYS * DAY_MS;

    const dated: Dated[] = [];
    for (const post of posts) {
      if (post.media.length === 0) continue;
      const at = momentDate(post);
      if (at === null) continue;
      if (Date.UTC(at.year, at.month - 1, at.day) > cutoff) continue;
      dated.push({ post, at });
    }

    const taken = new Set<string>();
    const tiles: RecommendationTile[] = [];

    const add = (entry: Dated | undefined, tile: { title: string; meta?: string }) => {
      if (entry === undefined || taken.has(entry.post.id)) return;
      // Ưu tiên tấm ẢNH đầu tiên làm bìa; bài chỉ toàn clip thì lấy clip đầu —
      // grid sẽ xin poster frame của nó chứ không nhét video vào <Image>.
      const cover =
        entry.post.media.find((m) => m.mimeType.startsWith('image/')) ?? entry.post.media[0];
      if (cover === undefined) return;

      taken.add(entry.post.id);
      tiles.push({
        target: { kind: 'post', id: entry.post.id },
        mediaId: cover.id,
        mimeType: cover.mimeType,
        ...tile,
      });
    };

    // 1. Same date, earlier year.
    const anniversaries = dated.filter(
      ({ at }) => at.month === today.month && at.day === today.day && at.year < today.year,
    );
    const anniversary = pick(anniversaries, seed);
    if (anniversary !== undefined) {
      add(anniversary, {
        title: t('home.recommend.onThisDay', { year: anniversary.at.year }),
      });
    }

    // 2. The earlier month with the most photographs behind it.
    const months = new Map<string, { entry: Dated; photos: number }>();
    for (const item of dated) {
      if (taken.has(item.post.id)) continue;
      const key = `${item.at.year}-${item.at.month}`;
      const bucket = months.get(key);
      if (bucket === undefined) months.set(key, { entry: item, photos: item.post.media.length });
      else bucket.photos += item.post.media.length;
    }
    const busiest = [...months.values()].sort((a, b) => b.photos - a.photos)[0];
    if (busiest !== undefined) {
      add(busiest.entry, {
        title: t('home.recommend.month', {
          month: t(`date.months.${busiest.entry.at.month}`),
          year: busiest.entry.at.year,
        }),
        meta: t('home.recommend.photoCount', { count: busiest.photos }),
      });
    }

    // 3. One of the viewer's own shelves. Only ones with a cover: an album
    //    with no picture chosen has nothing to put on a tile.
    const album = pick(
      albums.filter((item) => item.coverMediaId !== null),
      seed,
    );
    if (album?.coverMediaId != null) {
      tiles.push({
        target: { kind: 'album', id: album.id },
        mediaId: album.coverMediaId,
        // AlbumSummary không mang mime của bìa — coi là ảnh (bìa do người dùng
        // chọn tay, gần như luôn là ảnh); nếu là clip thì grid đã có
        // placeholder + onError đỡ phía sau, không còn ô trắng.
        mimeType: 'image/jpeg',
        title: t('home.recommend.album', { name: album.name }),
        meta: t('home.recommend.photoCount', { count: album.itemCount }),
      });
    }

    // 4. Whatever else the seed lands on.
    add(
      pick(
        dated.filter(({ post }) => !taken.has(post.id)),
        seed + 1,
      ),
      { title: t('home.recommend.lookBack') },
    );

    // Three is what the grid draws; the rules are ordered so the ones that
    // mean the most survive the cut.
    return tiles.slice(0, 3);
  }, [posts, albums, now, t]);
}

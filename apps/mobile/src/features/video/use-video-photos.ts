import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';

import { families } from '../../lib/api';
import type { FamilySummary } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';
import { useSession } from '../auth/session';
import { useFamilies } from '../family/use-families';
import { useVideoDraft } from './draft';

/** Một ô trong lưới màn 28 — kèm nguồn để lọc theo family group / Mine. */
export type VideoPhotoTile = {
  id: string;
  mimeType: string;
  postId: string;
  authorUserId: string;
  familyId: string;
  createdAt: string;
};

/**
 * Trang đầu mỗi feed là đủ cho lưới chọn.
 * 50 là TRẦN của server (`FeedQueryDto`: limit ≤ 50) — xin 60 thì cả request
 * trả 400 và lưới trắng trơn, không có lỗi nào hiện ra. Đừng nâng số này.
 */
const PAGE_LIMIT = 50;

/**
 * Ảnh/clip cho màn 28 (11m) — GOM TẤT CẢ family của user, vì filter chips của
 * design là các family group ("Everyone / <family> / Mine"), cộng thêm những
 * file user vừa upload ngay trên màn này (chúng chưa thuộc bài đăng nào nên
 * không có trong feed, nhưng vẫn phải hiện để thấy được ô đã chọn).
 */
export function useVideoPhotos(): {
  tiles: VideoPhotoTile[];
  familyList: FamilySummary[];
  isLoading: boolean;
} {
  const list = useFamilies();
  const familyList = useMemo(() => list.data ?? [], [list.data]);
  const { draft } = useVideoDraft();
  const { user } = useSession();

  const feeds = useQueries({
    queries: familyList.map((f) => ({
      queryKey: [...queryKeys.familyFeed(f.id), 'video-picker'],
      queryFn: () => families.feed(f.id, { limit: PAGE_LIMIT }),
      staleTime: 60 * 1000,
    })),
  });

  const tiles = useMemo(() => {
    const seen = new Set<string>();
    const all: VideoPhotoTile[] = [];

    // upload mới nhất đứng trước — vừa chọn là thấy ngay đầu lưới.
    // File tự upload luôn là "của mình", nên bộ lọc Mine phải giữ chúng lại.
    for (const u of draft.uploadedTiles) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      all.push({
        id: u.id,
        mimeType: u.mimeType,
        postId: '',
        authorUserId: user?.id ?? '',
        familyId: '',
        createdAt: u.createdAt,
      });
    }

    feeds.forEach((feed, index) => {
      const familyId = familyList[index]?.id ?? '';
      for (const post of feed.data?.items ?? []) {
        for (const m of post.media) {
          if (seen.has(m.id)) continue; // bài đăng chung nhiều family — không nhân đôi ô
          seen.add(m.id);
          all.push({
            id: m.id,
            mimeType: m.mimeType,
            postId: post.id,
            authorUserId: post.authorUserId,
            familyId,
            createdAt: post.createdAt,
          });
        }
      }
    });
    return all;
  }, [feeds, familyList, draft.uploadedTiles, user?.id]);

  return { tiles, familyList, isLoading: feeds.some((f) => f.isLoading) };
}

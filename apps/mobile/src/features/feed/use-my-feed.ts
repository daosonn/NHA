import { useInfiniteQuery } from '@tanstack/react-query';

import { myFeed } from '../../lib/api';
import type { FamilyFeed } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

/**
 * Dòng thời gian Home: bài từ MỌI nhà mình thuộc về, mới nhất trước.
 *
 * Thay cho `useFamilyFeed(activeFamilyId)` (Sơn chốt 26/08): Feed là của
 * chung, không phải "đang đứng ở nhà nào thì chỉ thấy bài nhà đó". Nhà đang
 * chọn vẫn điều khiển cây gia phả, Omoide, AI — không điều khiển feed nữa.
 *
 * Cursor-paginated như feed theo nhà: `nextCursor: null` là hết.
 */
export function useMyFeed() {
  return useInfiniteQuery({
    queryKey: queryKeys.myFeed(),
    queryFn: ({ pageParam }) => myFeed({ cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: FamilyFeed) => last.nextCursor,
  });
}

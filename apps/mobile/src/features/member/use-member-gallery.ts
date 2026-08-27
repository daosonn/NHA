import { useQuery } from '@tanstack/react-query';

import { gallery } from '../../lib/api';
import type { GalleryMediaItem } from '../../lib/api';
import { queryKeys } from '../../lib/query-keys';

export type MemberGallery = {
  /** Từng tấm một, mới nhất trước — đúng thứ tự server trả. */
  items: GalleryMediaItem[];
  photoCount: number;
};

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
 * Từng có bước gom cụm theo bài đăng ở đây (mỗi cụm một tile) — bỏ ngày
 * 26/08 theo yêu cầu của Sơn: tab Album giờ là lưới ảnh LẺ, mỗi tấm chạm vào
 * xem được ngay; đường về bài đăng gốc vẫn còn vì mỗi item vẫn mang `postId`.
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
    queryFn: async (): Promise<MemberGallery> => {
      const items = own
        ? await gallery.mine()
        : await gallery.forMember(familyId as string, memberId as string);
      return { items, photoCount: items.length };
    },
    enabled: own || memberScoped,
  });
}

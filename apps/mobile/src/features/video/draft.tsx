import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type {
  StoryboardResponse,
  VideoMood,
  VideoPlan,
  VideoStyleId,
  VideoTargetSec,
} from '../../lib/api';

/**
 * Bản nháp video đi xuyên màn 27→31 (Setup → Photos → Music → Style → Story & scenes).
 * Mỗi màn sửa một phần; "Build the story" đổi storyboard thành plan sửa được;
 * "Make the video" mới tạo VideoJob thật. Context (không lib state ngoài) — đúng
 * quy ước repo: client state = React context, server state = react-query.
 */

export type VideoDraft = {
  memberId: string | null;
  memberName: string;
  kind: 'year' | 'trip' | 'birthday' | 'memory';
  /**
   * Dịp do user tự đặt tên ("Ngày giỗ ông", "Bé vào lớp 1"…) — nút "+" ở màn 27.
   * Rỗng = dùng một trong bốn loại có sẵn. Gửi kèm sang AI làm nhãn dịp.
   */
  customKind: string;
  storyRequest: string;
  targetSec: VideoTargetSec;
  aspect: 'portrait' | 'landscape';
  style: VideoStyleId;
  musicId: string;
  musicLabel: string;
  /** "Gentle · 1:48" — dòng phụ của hàng Music ở màn 27 */
  musicMeta: string;
  mood: VideoMood;
  /** thứ tự CHỌN là thứ tự xuất hiện (màn 28 — "Numbers are the order they will appear") */
  mediaIds: string[];
  /**
   * image|video của từng media ĐÃ CHỌN, ghi lúc chọn.
   * Đếm clip và badge Photo/Clip không được phụ thuộc vào feed đang tải xong —
   * ảnh vừa upload chưa thuộc bài đăng nào nên feed không biết nó.
   */
  mediaKinds: Record<string, 'image' | 'video'>;
  /**
   * Ảnh/clip user vừa upload ở màn 28. Nằm trong draft (không phải state của màn)
   * để rời màn rồi quay lại vẫn thấy ô đã chọn — bug Sơn gặp 19/08.
   */
  uploadedTiles: { id: string; mimeType: string; createdAt: string }[];
  plan: VideoPlan | null;
};

const DEFAULT_DRAFT: VideoDraft = {
  memberId: null,
  memberName: '',
  kind: 'year',
  customKind: '',
  storyRequest: '',
  targetSec: 90,
  aspect: 'portrait',
  style: 'album',
  musicId: 'none',
  musicLabel: '',
  musicMeta: '',
  mood: 'warm',
  mediaIds: [],
  mediaKinds: {},
  uploadedTiles: [],
  plan: null,
};

type Ctx = {
  draft: VideoDraft;
  update: (patch: Partial<VideoDraft>) => void;
  applyStoryboard: (sb: StoryboardResponse) => void;
  reset: () => void;
};

const VideoDraftContext = createContext<Ctx | null>(null);

export function VideoDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<VideoDraft>(DEFAULT_DRAFT);

  const value = useMemo<Ctx>(
    () => ({
      draft,
      update: (patch) => setDraft((current) => ({ ...current, ...patch })),
      applyStoryboard: (sb) =>
        setDraft((current) => ({
          ...current,
          plan: {
            title: sb.title,
            subtitle: sb.subtitle,
            opening: sb.opening,
            closing: sb.closing,
            dedication: sb.dedication,
            palette: sb.palette,
            scenes: sb.scenes.map((s) => ({
              mediaId: s.media_id,
              durationS: s.duration_s,
              caption: s.caption,
              reason: s.reason || undefined,
            })),
          },
        })),
      reset: () => setDraft(DEFAULT_DRAFT),
    }),
    [draft],
  );

  return <VideoDraftContext.Provider value={value}>{children}</VideoDraftContext.Provider>;
}

/** Số clip trong danh sách đã chọn — suy từ mediaKinds, độc lập với việc feed đã tải xong. */
export function clipCountOf(draft: VideoDraft): number {
  return draft.mediaIds.filter((id) => draft.mediaKinds[id] === 'video').length;
}

export function useVideoDraft(): Ctx {
  const ctx = useContext(VideoDraftContext);
  if (!ctx) throw new Error('useVideoDraft must be used inside VideoDraftProvider');
  return ctx;
}

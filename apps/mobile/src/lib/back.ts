import { useRouter, type Href } from 'expo-router';

/** expo-router không export type Router — lấy từ chính hook. */
type Router = ReturnType<typeof useRouter>;

/**
 * "Quay lại" mà không bao giờ chết.
 *
 * `router.back()` trần throw GO_BACK khi stack chỉ có một entry — mà trên web
 * thì RELOAD ở bất kỳ URL nào cũng cho stack một entry, và deep link / bấm
 * thông báo cũng vậy. Trước 24/08 cả app có đúng MỘT chỗ guard đúng
 * (invite/[code]) và ~44 chỗ gọi trần; nút back của màn thông báo, nút X của
 * trình xem ảnh, cả bước "lưu xong thì lui" đều chết trong kịch bản đó.
 *
 * Không có gì phía sau thì `replace(fallback)` — replace chứ không push, vì
 * "quay lại" không được phép tạo thêm history để rồi back tiếp lại về đây.
 */
export function safeBack(router: Router, fallback: Href = '/'): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/** Bản hook cho component: `const goBack = useSafeBack('/albums')`. */
export function useSafeBack(fallback: Href = '/'): () => void {
  const router = useRouter();
  return () => safeBack(router, fallback);
}

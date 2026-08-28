import type { ImageSource } from 'expo-image';

import { apiAccessToken, media } from './api';

/**
 * The same object for the same file, on purpose.
 *
 * `expo-image` keys its web fetch effect on the *identity* of the source
 * object. Building a fresh `{ uri, headers }` on every render therefore
 * restarts the download every render — and its cleanup revokes the object
 * URL the previous pass just created, so the picture never settles and the
 * network is hammered for as long as the screen is open. Returning a cached
 * instance is what makes it load exactly once.
 */
const cache = new Map<string, ImageSource>();

/**
 * The headers are baked into the cached object, so a new token has to throw
 * the cache away — otherwise every image keeps presenting a token that has
 * been rotated out from under it.
 */
let cachedToken: string | null = null;

/**
 * What to hand an image or video component for one uploaded file.
 *
 * `GET /media/:id` is authenticated (`docs/00-shared/api-contract.md`), so a
 * bare URL renders as a broken image. On native the header is passed to the
 * loader; on web `expo-image` fetches the bytes itself and hands the view an
 * object URL, because an `<img>` element cannot carry an Authorization
 * header of its own.
 */
export function mediaSource(mediaId: string): ImageSource {
  return build(mediaId, media.streamUrl(mediaId));
}

/**
 * Ảnh để VẼ cho một media, dù nó là ảnh hay video.
 *
 * Một file mp4 đưa vào thành phần ảnh chỉ ra ô trống, nên video lấy ảnh xem
 * trước (`GET /media/:id/poster` — server trích khung đầu và giữ lại). Chỗ nào
 * cần chính file gốc để phát thì vẫn gọi `mediaSource`.
 */
export function thumbnailSource(mediaId: string, mimeType: string): ImageSource {
  // A grid tile is ~120pt wide and used to be served the original — a PNG
  // averaging 1.7 MB, some of them 4.7. Both branches now fetch something
  // made for the size it is drawn at.
  return mimeType.startsWith('video/')
    ? build(`poster:${mediaId}`, media.posterUrl(mediaId))
    : build(`thumb:${mediaId}`, media.thumbUrl(mediaId));
}

function build(cacheKey: string, uri: string): ImageSource {
  const token = apiAccessToken();

  if (token !== cachedToken) {
    cache.clear();
    cachedToken = token;
  }

  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  const source: ImageSource = {
    uri,
    headers: token === null ? undefined : { Authorization: `Bearer ${token}` },
  };

  cache.set(cacheKey, source);
  return source;
}

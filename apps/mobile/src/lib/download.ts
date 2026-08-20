/**
 * Handing the viewer a file to keep — and the two platforms do it differently.
 *
 * On web the bytes are already in the page: `GET /video-jobs/:id/file` is
 * authenticated, so a plain `<a href>` would 401. The file has to be fetched
 * with the bearer header first and then offered as a blob download — the same
 * reason `mediaSource` fetches image bytes itself.
 *
 * On native this file is not used at all: `expo-media-library` writes into the
 * camera roll instead (see `app/video/[id].tsx`).
 */

/** The DOM, when there is one. Native has no `document` and must not pretend. */
function webDocument(): Document | null {
  return (globalThis as { document?: Document }).document ?? null;
}

export function isWebRuntime(): boolean {
  return webDocument() !== null;
}

/**
 * Fetches an authenticated URL and lets the browser save it under `filename`.
 * Returns false when there is no DOM to do it with.
 */
export async function downloadAuthenticated(
  url: string,
  filename: string,
  accessToken: string | null,
): Promise<boolean> {
  const doc = webDocument();
  if (doc === null) return false;

  const response = await fetch(url, {
    headers: accessToken === null ? undefined : { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`download failed: ${response.status}`);

  const objectUrl = URL.createObjectURL(await response.blob());
  const link = doc.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';
  doc.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in Safari, so let it settle.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  return true;
}

/**
 * An object URL for an authenticated media file, for the players that cannot
 * carry a header themselves (`<video>` on web). Caller revokes it.
 */
export async function objectUrlFor(url: string, accessToken: string | null): Promise<string> {
  const response = await fetch(url, {
    headers: accessToken === null ? undefined : { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
  return URL.createObjectURL(await response.blob());
}

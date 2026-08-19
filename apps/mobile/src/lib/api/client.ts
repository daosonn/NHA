/**
 * The one way the app talks to `apps/api`.
 *
 * Deliberately small: a base URL, a bearer token, one retry after a refresh,
 * and error handling. It is not a data layer — caching, deduplication and
 * loading state belong to `@tanstack/react-query` on top of this
 * (`docs/01-frontend/architecture.md` § State), and putting them here would
 * mean two of everything later.
 */
import { ApiError, type ApiErrorBody } from './errors';

/**
 * The token is *supplied*, not stored here.
 *
 * Where a session lives is an auth decision — `expo-secure-store`, never
 * `AsyncStorage` (`CLAUDE.md` § 5). This module only needs to be able to ask.
 */
export type ApiConfig = {
  /** Origin plus the server's global prefix, e.g. `http://10.0.2.2:3000/api`. */
  baseUrl: string;
  getAccessToken: () => string | null;
  /**
   * Called when an authenticated request comes back 401. Resolve `true` once
   * a fresh token is available and the request will be sent again, exactly
   * once; resolve `false` and the 401 is handed to the caller.
   *
   * Never call this directly — go through `refreshOnce`, which collapses
   * concurrent callers into a single attempt.
   */
  onUnauthorized?: () => Promise<boolean>;
};

/**
 * `EXPO_PUBLIC_` is the only prefix Expo inlines into the client bundle, so
 * this value is public by construction. A base URL is fine; a secret never
 * belongs behind this prefix.
 *
 * `localhost` is wrong on a device and on the Android emulator — it resolves
 * to the phone itself. Set `EXPO_PUBLIC_API_URL` to the machine's LAN
 * address, or `http://10.0.2.2:3000/api` for the emulator.
 */
const DEFAULT_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

let config: ApiConfig = {
  baseUrl: DEFAULT_BASE_URL,
  getAccessToken: () => null,
};

/** Called once at startup, before any request goes out. */
export function configureApi(next: Partial<ApiConfig>): void {
  config = { ...config, ...next };
}

/**
 * The current bearer token, for the few consumers that cannot go through
 * `apiRequest` — an image or video player is handed a URL plus headers and
 * fetches the bytes itself.
 */
export function apiAccessToken(): string | null {
  return config.getAccessToken();
}

export function apiBaseUrl(): string {
  return config.baseUrl;
}

export type RequestOptions = {
  /** `PUT` only where the server models a single-valued resource — `reactions.set`. */
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Serialised as JSON, unless it is `FormData`, which is sent as-is. */
  body?: unknown;
  /** Off for register/login/refresh, which have no token yet. */
  authenticated?: boolean;
  signal?: AbortSignal;
};

function isErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'message' in value;
}

/**
 * At most one refresh in the air, ever.
 *
 * Opening the app fires several queries at once; if the access token has
 * expired they all come back 401 together. Without this, each would spend
 * the same single-use refresh token, the first would win and the rest would
 * be rejected — taking the session down with them. Everyone waits on the
 * same promise and then retries with whatever it produced.
 */
let inFlightRefresh: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  if (inFlightRefresh === null) {
    const handler = config.onUnauthorized;

    inFlightRefresh = (handler === undefined ? Promise.resolve(false) : handler())
      .catch(() => false)
      .finally(() => {
        inFlightRefresh = null;
      });
  }

  return inFlightRefresh;
}

/** Only exported for tests and for a full sign-out to reset the gate. */
export function resetRefreshState(): void {
  inFlightRefresh = null;
}

type RawResponse = { status: number; ok: boolean; payload: unknown };

async function send(path: string, options: RequestOptions): Promise<RawResponse> {
  const { method = 'GET', body, authenticated = true, signal } = options;

  // A multipart upload must set its own Content-Type: the boundary is part
  // of it, and only the runtime knows what it picked.
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json';

  if (authenticated) {
    const token = config.getAccessToken();
    if (token !== null) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : multipart ? (body as FormData) : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    // No status to report: the request never reached the server.
    throw ApiError.offline(cause);
  }

  // 204 and an empty 200 both have no body to parse.
  const text = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    payload: text === '' ? null : safeParse(text),
  };
}

/**
 * One request, one parsed result.
 *
 * Every non-2xx becomes an `ApiError` rather than a rejected promise with a
 * raw `Response`: a caller that forgets to check `response.ok` gets a body
 * that type-checks as the success shape and fails somewhere far away.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let result = await send(path, options);

  // An expired access token is the ordinary case, not an error worth showing.
  // `authenticated: false` requests are excluded so that refresh itself —
  // which is one of them — can never recurse into this.
  if (result.status === 401 && options.authenticated !== false) {
    const recovered = await refreshOnce();
    if (recovered) result = await send(path, options);
  }

  if (!result.ok) {
    throw ApiError.fromResponse(result.status, isErrorBody(result.payload) ? result.payload : null);
  }

  return result.payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // A proxy or tunnel returning an HTML error page, not the API.
    return null;
  }
}

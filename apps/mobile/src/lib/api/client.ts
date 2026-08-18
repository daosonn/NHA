/**
 * The one way the app talks to `apps/api`.
 *
 * Deliberately small: a base URL, a bearer token, and error handling. It is
 * not a data layer — caching, retries and loading state belong to
 * `@tanstack/react-query` on top of this (`docs/01-frontend/architecture.md`
 * § State), and putting them here would mean two of everything later.
 */
import { ApiError, type ApiErrorBody } from './errors';

/**
 * The token is *supplied*, not stored here.
 *
 * Where a session lives is an auth decision — `expo-secure-store` when the
 * real one lands, never `AsyncStorage` (`CLAUDE.md` § 5). This module only
 * needs to be able to ask.
 */
export type ApiConfig = {
  /** Origin plus the server's global prefix, e.g. `http://10.0.2.2:3000/api`. */
  baseUrl: string;
  getAccessToken: () => string | null;
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

export function apiBaseUrl(): string {
  return config.baseUrl;
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Serialised as JSON. Omit for GET. */
  body?: unknown;
  /** Off for register/login/refresh, which have no token yet. */
  authenticated?: boolean;
  signal?: AbortSignal;
};

function isErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'message' in value;
}

/**
 * One request, one parsed result.
 *
 * Every non-2xx becomes an `ApiError` rather than a rejected promise with a
 * raw `Response`: a caller that forgets to check `response.ok` gets a body
 * that type-checks as the success shape and fails somewhere far away.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, authenticated = true, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (authenticated) {
    const token = config.getAccessToken();
    if (token !== null) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    // No status to report: the request never reached the server.
    throw ApiError.offline(cause);
  }

  // 204 and an empty 200 both have no body to parse.
  const text = await response.text();
  const payload: unknown = text === '' ? null : safeParse(text);

  if (!response.ok) {
    throw ApiError.fromResponse(response.status, isErrorBody(payload) ? payload : null);
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // A proxy or tunnel returning an HTML error page, not the API.
    return null;
  }
}

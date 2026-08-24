/**
 * NestJS's default error body.
 *
 * `message` is a string for a thrown `HttpException` and an **array** when
 * `ValidationPipe` rejects a DTO — one entry per failed constraint. Both
 * shapes come out of the same endpoints, so both have to be handled.
 */
export type ApiErrorBody = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  /** Machine-readable marker some routes send instead of a message — e.g. the
   * AI guard's 503 `{ code: 'AI_UNAVAILABLE' }`, which has no `message` at all. */
  code?: string;
};

/** Set when the request never reached the server. */
export const OFFLINE_STATUS = 0;

/**
 * Anything that stopped a request from returning data.
 *
 * Carries the status so a caller can tell the cases apart that actually need
 * different handling — 401 means sign in again, 409 means the email is taken,
 * 0 means the phone is on a train.
 */
export class ApiError extends Error {
  readonly status: number;
  /** Every validation message, when the server sent more than one. */
  readonly details: string[];
  /** The body's machine-readable `code`, when the server sent one. */
  readonly code: string | null;

  constructor(status: number, message: string, details: string[] = [], code: string | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.code = code;
  }

  static fromResponse(status: number, body: ApiErrorBody | null): ApiError {
    if (body === null) {
      return new ApiError(status, `Request failed with status ${status}`);
    }

    const details = (Array.isArray(body.message) ? body.message : [body.message]).filter(
      (entry): entry is string => typeof entry === 'string',
    );
    // The first constraint is the one worth showing; the rest stay available.
    return new ApiError(
      status,
      details[0] ?? body.error ?? body.code ?? 'Request failed',
      details,
      body.code ?? null,
    );
  }

  static offline(cause: unknown): ApiError {
    const error = new ApiError(OFFLINE_STATUS, 'Could not reach the server');
    error.cause = cause;
    return error;
  }

  /** No usable session — the caller should send the person back to sign-in. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  /**
   * The AI service is off or unreachable (503 `AI_UNAVAILABLE`). The product
   * rule is that the core app keeps working — screens should say "the AI
   * helper is unavailable right now", never a generic failure.
   */
  get isAiUnavailable(): boolean {
    return this.status === 503 && (this.code === 'AI_UNAVAILABLE' || this.code === null);
  }

  get isOffline(): boolean {
    return this.status === OFFLINE_STATUS;
  }
}

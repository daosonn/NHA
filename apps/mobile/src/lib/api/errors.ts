/**
 * NestJS's default error body.
 *
 * `message` is a string for a thrown `HttpException` and an **array** when
 * `ValidationPipe` rejects a DTO — one entry per failed constraint. Both
 * shapes come out of the same endpoints, so both have to be handled.
 */
export type ApiErrorBody = {
  statusCode?: number;
  message: string | string[];
  error?: string;
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

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  static fromResponse(status: number, body: ApiErrorBody | null): ApiError {
    if (body === null) {
      return new ApiError(status, `Request failed with status ${status}`);
    }

    const details = Array.isArray(body.message) ? body.message : [body.message];
    // The first constraint is the one worth showing; the rest stay available.
    return new ApiError(status, details[0] ?? body.error ?? 'Request failed', details);
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

  get isOffline(): boolean {
    return this.status === OFFLINE_STATUS;
  }
}

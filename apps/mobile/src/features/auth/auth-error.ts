import { ApiError } from '../../lib/api';

/**
 * Turns a failed auth request into a catalogue key.
 *
 * A key rather than a sentence, because the server's own messages are
 * English — `ValidationPipe` emits "password must be longer than or equal to
 * 8 characters" — and putting those on screen would leave one untranslated
 * string in the middle of a Japanese form
 * (`docs/01-frontend/architecture.md` § Language).
 *
 * Statuses come from `docs/00-shared/api-contract.md`: 401 is a wrong pair,
 * 409 is an email that already exists, 400 is a rejected DTO.
 */
export function authErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'errors.generic';

  if (error.isOffline) return 'errors.offline';

  switch (error.status) {
    case 400:
      return 'auth.errors.checkFields';
    case 401:
      return 'auth.errors.invalidCredentials';
    case 409:
      return 'auth.errors.emailTaken';
    default:
      return 'errors.generic';
  }
}

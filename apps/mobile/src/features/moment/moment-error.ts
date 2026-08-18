import { ApiError } from '../../lib/api';

/**
 * Upload and post failures the person can actually act on.
 *
 * 413 and 415 come from the media endpoint and mean a specific file is the
 * problem — worth saying, because "something went wrong" would leave them
 * retrying the same photo. Everything else stays generic rather than
 * repeating the server's English validation text into a Japanese screen.
 */
export function momentErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'errors.generic';
  if (error.isOffline) return 'errors.offline';

  switch (error.status) {
    case 413:
      return 'moment.errors.tooLarge';
    case 415:
      return 'moment.errors.unsupported';
    case 400:
      return 'moment.errors.empty';
    default:
      return 'errors.generic';
  }
}

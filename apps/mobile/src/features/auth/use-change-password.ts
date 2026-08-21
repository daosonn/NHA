import { useMutation } from '@tanstack/react-query';

import { auth } from '../../lib/api';
import type { ChangePasswordRequest } from '../../lib/api';
import { saveSession } from './session-store';

/**
 * Changes the password without signing this device out.
 *
 * The server revokes **every** refresh token and hands back a fresh pair for
 * the caller, so the tokens that made this request are dead by the time it
 * returns. Storing the response is therefore not an optimisation — skip it
 * and the next 401 has nothing left to refresh with, and the person who just
 * changed their password is thrown out of the app for their trouble.
 *
 * `saveSession` without options keeps whatever "keep me signed in" choice
 * was made at sign-in: this is the same session, not a new one.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: ChangePasswordRequest) => {
      await saveSession(await auth.changePassword(body));
    },
  });
}

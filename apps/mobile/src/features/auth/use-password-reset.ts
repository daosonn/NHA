import { useMutation } from '@tanstack/react-query';

import { auth } from '../../lib/api';
import type {
  ConfirmPasswordResetRequest,
  RequestPasswordResetRequest,
  VerifyResetCodeRequest,
} from '../../lib/api';

/**
 * Send the six-digit code.
 *
 * The server answers `{ success: true }` for an address it has never seen, on
 * purpose: a different answer for a registered address would turn this into a
 * way to ask whether somebody has an account. So the screen must move on
 * either way and never say "no such account" — there is nothing here that
 * knows.
 */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (body: RequestPasswordResetRequest) => auth.requestPasswordReset(body),
  });
}

/**
 * Check the code without spending it.
 *
 * Note the shape: `{ valid: boolean }`, not an error. A wrong code is a
 * **successful request** carrying a "no", so callers have to read the body —
 * a `mutateAsync` that resolves is not proof the code was right.
 */
export function useVerifyResetCode() {
  return useMutation({
    mutationFn: (body: VerifyResetCodeRequest) => auth.verifyResetCode(body),
  });
}

/**
 * Spend the code and set the password.
 *
 * The server revokes every refresh token this account has, so anyone signed
 * in elsewhere is signed out — which is the point of resetting a password
 * you think somebody else knows. The device doing the reset has no session
 * either, so it lands on sign-in.
 */
export function useConfirmPasswordReset() {
  return useMutation({
    mutationFn: (body: ConfirmPasswordResetRequest) => auth.confirmPasswordReset(body),
  });
}

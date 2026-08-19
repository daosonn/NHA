/**
 * An invitation code held across the sign-up detour.
 *
 * Somebody who opens an invite link without an account has to register before
 * they can accept, and the auth group sends every newly signed-in person to
 * Home the moment the session appears (`app/(auth)/_layout.tsx`). Passing the
 * code along as a route param loses that race: the redirect and the return
 * navigation fire on the same tick.
 *
 * So the code waits here instead — module scope, outside React, the same
 * shape as `features/auth/session-store.ts` — and Home hands it back on the
 * way past. Deliberately not persisted: it belongs to one uninterrupted trip
 * through sign-up, and a code still sitting in storage a week later would
 * yank somebody into a family screen they had forgotten about.
 */
let pending: string | null = null;

export function setPendingInvite(code: string): void {
  pending = code;
}

/** Reads and clears in one step, so a code can only ever be redeemed once. */
export function takePendingInvite(): string | null {
  const code = pending;
  pending = null;
  return code;
}

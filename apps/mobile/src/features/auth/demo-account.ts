/**
 * The public demo login, prefilled on the sign-in screen when the welcome
 * CTA sends someone there (`/sign-in?demo=1`).
 *
 * This is NOT a secret — it exists to be typed into a public demo by
 * strangers, and shipping it in the client is the point. Nothing personal
 * belongs in this account, and it must never hold credentials to anything
 * beyond its own demo data (owner's call, 2026-09-03).
 */
export const DEMO_ACCOUNT = {
  email: 'user.alphaclub@gmail.com',
  password: '12345678',
} as const;

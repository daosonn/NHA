import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

/**
 * `router.back()` that survives an empty history.
 *
 * Every screen is reachable by URL on web — and by deep link on native, the
 * day a scheme is registered — and after a reload the navigation stack is
 * empty: a bare `back()` then throws `The action 'GO_BACK' was not handled`.
 * Falling back to Home is always safe; Home re-routes to auth on its own
 * when there is no session. (The pattern `app/invite/[code].tsx` worked out
 * for share links, promoted to the one home for every back affordance.)
 */
export function goBack(router: Router): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

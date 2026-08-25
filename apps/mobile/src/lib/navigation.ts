import { router } from 'expo-router';

/** Whatever `router.replace` accepts — typed routes generate the union. */
type Destination = Parameters<typeof router.replace>[0];

/**
 * Going back, without the possibility of dead-ending.
 *
 * `router.back()` on its own assumes there is something behind the screen, and
 * on the web there very often is not: a link to a post, a person or an
 * invitation is opened directly, and that screen is the first entry in the
 * history. The back arrow then either does nothing at all or leaves the app
 * entirely — and on native, calling it with an empty stack is an error that
 * takes the navigator down with it, which is the worst version because
 * recovering means mounting the whole tree again.
 *
 * So every back arrow, cancel and post-action return goes through here. When
 * there is nowhere to go back to it lands on Home instead, which is somewhere
 * every signed-in reader is allowed to be. `replace`, not `push`: the screen
 * being left should not stay in the history behind Home.
 *
 * The imperative `router` rather than the `useRouter()` hook so that this works
 * from anywhere — a nested component, a mutation's `onSuccess` — without each
 * caller having to thread a hook down to it.
 */
export function goBack(fallback: Destination = '/') {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
}

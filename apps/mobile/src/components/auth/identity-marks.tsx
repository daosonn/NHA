import Svg, { Path } from 'react-native-svg';

import { colors } from '../../theme';

/**
 * Provider logos, drawn rather than imported.
 *
 * Each provider's brand guidelines fix these shapes and colours: they are
 * the one place in the app where the palette does not apply, so they live
 * here instead of being mistaken for icons.
 *
 * Apple was here and was removed on 2026-08-18 — see `project-status.md`.
 * Putting it back is a product decision, not a styling one: App Store
 * guideline 4.8 ties it to whether the iOS build ships any other
 * third-party login at all.
 */

export function GoogleMark({ size = 19 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M21.6 12.23c0-.7-.06-1.37-.18-2.02H12v3.82h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.74 2.98-4.3 2.98-7.32Z"
      />
      <Path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
      />
      <Path fill="#FBBC05" d="M6.41 13.9a6 6 0 0 1 0-3.81V7.5H3.06a10 10 0 0 0 0 9l3.35-2.6Z" />
      <Path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2a10 10 0 0 0-8.94 5.5l3.35 2.6C7.2 7.73 9.4 5.97 12 5.97Z"
      />
    </Svg>
  );
}

export function FacebookMark({ size = 19 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#1877F2"
        d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z"
      />
    </Svg>
  );
}

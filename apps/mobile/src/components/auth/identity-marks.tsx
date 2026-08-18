import Svg, { Path } from 'react-native-svg';

import { colors } from '../../theme';

/**
 * Provider logos, drawn rather than imported.
 *
 * Apple's and Google's brand guidelines fix these shapes and colours: they
 * are the one place in the app where the palette does not apply, so they
 * live here instead of being mistaken for icons.
 */
export function AppleMark({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={colors.text.primary}
        d="M17.05 12.54c-.02-2.2 1.8-3.25 1.88-3.3-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.87-.76-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.87.69 1.18-.02 1.93-1.08 2.65-2.14.83-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.53ZM14.9 5.9c.6-.74 1.01-1.76.9-2.78-.87.04-1.93.58-2.56 1.31-.56.65-1.06 1.7-.92 2.7.97.07 1.97-.5 2.58-1.23Z"
      />
    </Svg>
  );
}

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

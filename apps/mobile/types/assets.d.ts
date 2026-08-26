/**
 * Metro resolves asset imports to a numeric module id, but `expo/types` only
 * declares CSS. Fonts are imported by path (see `app/_layout.tsx`), so
 * TypeScript needs to be told what they are.
 */
declare module '*.ttf' {
  const asset: number;
  export default asset;
}

declare module '*.otf' {
  const asset: number;
  export default asset;
}

/** Bundled bitmaps (src/fixtures/news.ts) — same numeric module id as fonts. */
declare module '*.jpg' {
  const asset: number;
  export default asset;
}

declare module '*.png' {
  const asset: number;
  export default asset;
}

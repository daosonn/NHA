/**
 * `jsxImportSource: nativewind` is what lets every core component accept
 * `className`. The worklets plugin must stay last — Reanimated 4 moved it out
 * of `react-native-reanimated/plugin`.
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: ['react-native-worklets/plugin'],
  };
};

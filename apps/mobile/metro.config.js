// Metro must be told about the monorepo: sources live in apps/mobile but most
// dependencies are hoisted to the workspace root, and packages/* are consumed
// straight from source.
// See docs/04-devops/mobile-development.md
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Hierarchical lookup must stay ON. Several dependencies pin their own copy
// of a package in a nested node_modules — `@expo/metro-runtime` pins
// pretty-format@29 while apps/api's jest hoists pretty-format@30 to the root.
// Disabling the lookup makes Metro resolve the hoisted v30 ESM build, whose
// interop shape breaks the dev-only HMR client with
// "Cannot read properties of undefined (reading 'default')" — a blank screen
// on web with a production build that still works fine.
config.resolver.disableHierarchicalLookup = false;

module.exports = withNativeWind(config, { input: './global.css' });

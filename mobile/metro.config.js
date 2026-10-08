// Metro configuration for this monorepo.
//
// `mobile` is an npm workspace that imports `@quran-review/shared` — the
// contracts, validators and enums the API is built from — and that package
// lives OUTSIDE this project folder, at ../packages/shared, with `main`
// pointing at TypeScript source rather than a build output.
//
// Expo's default config only watches this folder and resolves modules from
// mobile/node_modules upward. That happens to work when a root `npm install`
// has left a symlink in <root>/node_modules/@quran-review/shared — and fails
// with "Unable to resolve module @quran-review/shared" in any clone where it
// has not, which is what a fresh checkout plus `npm install` inside mobile/
// produces. The failure surfaces as a red screen on app start, not at install
// time.
//
// So: tell Metro where the monorepo is, where to look for modules, and map the
// shared package to its real path so resolution does not depend on a symlink
// existing at all.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const sharedPackage = path.resolve(workspaceRoot, 'packages/shared');

const config = getDefaultConfig(projectRoot);

// Watch the workspace so edits to packages/shared trigger a rebuild, and so
// Metro is willing to transpile its TypeScript source (files outside
// projectRoot are not watched — or transformed — by default).
config.watchFolders = [sharedPackage];

// Resolve from this package first, then the hoisted root — npm may place a
// dependency in either.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Resolve the workspace package by path, not by symlink. This is what makes a
// fresh clone work without a root install having linked it.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@quran-review/shared': sharedPackage,
};

module.exports = config;

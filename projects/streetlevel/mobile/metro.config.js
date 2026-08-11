const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Monorepo wiring. `@streetlevel/shared` is not a published package — it is a
 * sibling workspace symlinked into the root `node_modules`. Metro does not
 * follow that by default, so without both of these it fails to resolve the wire
 * contract and the app dies at import time rather than at build time.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// npm hoists nearly everything to the workspace root and leaves the occasional
// version-conflicting copy inside mobile/node_modules. Hierarchical lookup is
// what finds those nested copies, so turning it off would break the exceptions.
config.resolver.disableHierarchicalLookup = false;

module.exports = config;

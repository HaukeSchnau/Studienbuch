const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The web's SQLite worker loads wa-sqlite's wasm build as an asset.
config.resolver.assetExts.push("wasm");

// Our imports name the file with its extension (lint rule `import/extensions`), and Metro picks a
// platform file such as `Database.web.ts` only for a specifier without one. So relative imports of
// our own TypeScript lose the extension before Metro resolves them.
const ownTypeScript = /^\.{1,2}\/.*\.tsx?$/;

config.resolver.resolveRequest = (context, moduleName, platform) =>
  context.resolveRequest(
    context,
    ownTypeScript.test(moduleName) && !context.originModulePath.includes("/node_modules/")
      ? moduleName.replace(/\.tsx?$/, "")
      : moduleName,
    platform,
  );

module.exports = config;

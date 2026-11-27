const { createHash } = require("node:crypto");
const { getConfig } = require("expo/config");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Store builds name the commit they bundle (BuildInfo.revision). Calder gives every step its commit
// without keying the step on it, so a store build is reused until the app's files change.
if (process.env.CALDER_REVISION !== undefined) {
  process.env.EXPO_PUBLIC_REVISION ??= process.env.CALDER_REVISION;
}

// babel-preset-expo inlines the public app config into transformed modules (expo-router reads its
// plugin options from it), but Metro's cache key leaves the config out. Keyed on it, as the preset
// reads it, a config change needs no `--clear`, and worktrees share the default /tmp/metro-cache:
// each one reuses the transforms of its own config.
const { exp } = getConfig(__dirname, { isPublicConfig: true, skipSDKVersionRequirement: true });

config.cacheVersion = createHash("sha256").update(JSON.stringify(exp)).digest("hex");

// The web's SQLite worker loads wa-sqlite's wasm build as an asset.
config.resolver.assetExts.push("wasm");

// SQL migrations and the conformance fixture are text modules (metro.transformer.js).
config.resolver.sourceExts.push("sql", "jsonl");

config.transformer.babelTransformerPath = require.resolve("./metro.transformer.js");

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

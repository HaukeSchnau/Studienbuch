// Learn more https://docs.expo.io/guides/customizing-metro
const path = require("node:path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname, {
  annotateReactComponents: false,
  includeWebReplay: false,
});

config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer/expo");
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== "svg");
config.resolver.sourceExts.push("svg");

// SDK 57 resolves files outside watchFolders on demand. Keep hot reload for the app and the
// workspace packages it owns without installing filesystem watchers across the whole monorepo.
config.watchFolders = [
  __dirname,
  path.resolve(__dirname, "../../packages/core"),
  path.resolve(__dirname, "../../packages/observability"),
];

module.exports = withNativewind(config, {
  input: "./src/global.css",
});

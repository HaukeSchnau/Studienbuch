// Learn more https://docs.expo.io/guides/customizing-metro
const { FileStore } = require("metro-cache");
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = withTurborepoManagedCache(getDefaultConfig(__dirname));

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "./node_modules"),
  path.resolve(__dirname, "../node_modules"),
  path.resolve(__dirname, "../../../node_modules"),
];

config.resolver.extraNodeModules = {
  "@stu/expo-native-modules": "..",
};

config.watchFolders = [path.resolve(__dirname, "..")];

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;

/**
 * Move the Metro cache to the `.cache/metro` folder.
 * If you have any environment variables, you can configure Turborepo to invalidate it when needed.
 *
 * @see https://turbo.build/repo/docs/reference/configuration#env
 * @param {import('expo/metro-config').MetroConfig} config
 * @returns {import('expo/metro-config').MetroConfig}
 */
function withTurborepoManagedCache(config) {
  config.cacheStores = [
    new FileStore({ root: path.join(__dirname, ".cache/metro") }),
  ];
  return config;
}

import type { ExpoConfig } from "expo/config";

const defineConfig = (): ExpoConfig => ({
  name: "IGS Lilienthal",
  slug: "studienbuch",
  scheme: "studienbuch",
  version: "1.4.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/icon.png",
    resizeMode: "contain",
    backgroundColor: "#FFFFFF",
  },
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    bundleIdentifier: "de.haukeschnau.classMate",
    supportsTablet: true,
  },
  android: {
    package: "de.haukeschnau.class_mate",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#FFFFFF",
    },
  },
  // extra: {
  //   eas: {
  //     projectId: "your-eas-project-id",
  //   },
  // },
  experiments: {
    tsconfigPaths: true,
    typedRoutes: true,
  },
  plugins: ["expo-router"],
});

export default defineConfig;

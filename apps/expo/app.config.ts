import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Studienbuch",
  slug: "studienbuch",
  scheme: "expo",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  splash: {
    image: "./assets/icon.png",
    resizeMode: "contain",
    backgroundColor: "#6DB769",
  },
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    bundleIdentifier: "de.haukeschnau.studienbuch",
    supportsTablet: true,
  },
  android: {
    package: "de.haukeschnau.studienbuch",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#FFFFFF",
    },
  },
  extra: {
    eas: {
      projectId: "ae447793-ffd9-47fd-bee7-321ed3af41e8",
    },
  },
  experiments: {
    tsconfigPaths: true,
    typedRoutes: true,
  },
  plugins: [
    "expo-router",
    [
      "expo-font",
      {
        fonts: [
          "../../node_modules/@expo-google-fonts/nunito/Nunito_400Regular.ttf",
        ],
      },
    ],
    [
      "expo-build-properties",
      {
        ios: {
          deploymentTarget: "15.0",
        },
        android: {},
      },
    ],
  ],
});

import type { ConfigContext, ExpoConfig } from "@expo/config";

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
    bundleIdentifier: "dev.schnau.studienbuch",
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "dev.schnau.studienbuch",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#6DB769",
    },
  },
  extra: {
    eas: {
      projectId: "76a4b2c7-e6dc-40fa-808e-27c1b574d342",
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
          "../../node_modules/@expo-google-fonts/nunito/Nunito_400Regular_Italic.ttf",
          "../../node_modules/@expo-google-fonts/nunito/Nunito_500Medium.ttf",
          "../../node_modules/@expo-google-fonts/nunito/Nunito_600SemiBold.ttf",
          "../../node_modules/@expo-google-fonts/nunito/Nunito_700Bold.ttf",
        ],
      },
    ],
    "expo-secure-store",
    "expo-sqlite",
    "expo-web-browser",
    [
      "expo-notifications",
      {
        icon: "./assets/icon.png",
        color: "#6DB769",
        defaultChannel: "default",
        enableBackgroundRemoteNotifications: false,
      },
    ],
  ],
});

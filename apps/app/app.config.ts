import type { ConfigContext, ExpoConfig } from "expo/config";

import { withBackupExclusion } from "./modules/backup-exclusion/plugin.ts";

// The EAS project of `dev.schnau.studienbuch` on Hauke's Expo account, carried over from the old tree.
const projectId = "76a4b2c7-e6dc-40fa-808e-27c1b574d342";

const identity = "dev.schnau.studienbuch";

// Release steps (`@calder-ci/std/Expo`) stamp a build number into every store build and choose the
// EAS Update channel: `beta` for TestFlight and Play internal, `production` for store releases. The
// version comes from package.json, which fingerprint.config.js hashes as well.
const { IOS_BUILD_NUMBER, ANDROID_VERSION_CODE, STUDIENBUCH_CHANNEL } = process.env;

const nunito = (weight: number, name: string) => ({
  weight,
  path: `./node_modules/@expo-google-fonts/nunito/${weight}${name}/Nunito_${weight}${name}.ttf`,
});

// The weights the type tokens use (packages/ui, Tokens.type).
const nunitoFaces = [
  nunito(500, "Medium"),
  nunito(600, "SemiBold"),
  nunito(700, "Bold"),
  nunito(800, "ExtraBold"),
];

export default ({ config }: ConfigContext): ExpoConfig =>
  withBackupExclusion({
    ...config,
    name: "Studienbuch",
    slug: "studienbuch",
    owner: "haukeschnau",
    scheme: "studienbuch",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    icon: "./assets/icon.png",
    runtimeVersion: { policy: "fingerprint" },
    updates: {
      url: `https://u.expo.dev/${projectId}`,
      requestHeaders: { "expo-channel-name": STUDIENBUCH_CHANNEL ?? "beta" },
    },
    ios: {
      bundleIdentifier: identity,
      // Urbs UG, which owns the App Store account.
      appleTeamId: "2243J9RD68",
      buildNumber: IOS_BUILD_NUMBER ?? "1",
    },
    android: {
      package: identity,
      versionCode: Number(ANDROID_VERSION_CODE ?? "1"),
      predictiveBackGestureEnabled: true,
      adaptiveIcon: {
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
    },
    web: { output: "single", favicon: "./assets/favicon.png" },
    plugins: [
      "expo-router",
      ["expo-sqlite", { useSQLCipher: true }],
      // The backup rules of modules/backup-exclusion also leave out the secure store's entries.
      ["expo-secure-store", { configureAndroidBackup: false }],
      "react-native-quick-crypto",
      [
        "expo-font",
        {
          ios: { fonts: nunitoFaces.map((face) => face.path) },
          android: { fonts: [{ fontFamily: "Nunito", fontDefinitions: nunitoFaces }] },
        },
      ],
      [
        "expo-splash-screen",
        { backgroundColor: "#6DB868", image: "./assets/icon.png", imageWidth: 200 },
      ],
    ],
    experiments: { typedRoutes: true, reactCompiler: true, baseUrl: "/app" },
    extra: { eas: { projectId } },
  });

import type { ConfigContext, ExpoConfig } from "expo/config";

import { withBackupExclusion } from "./modules/device-files/plugin.ts";
import { withPasskeys } from "./src/infra/passkeys/plugin.ts";

// The EAS project of `dev.schnau.studienbuch` on Hauke's Expo account, carried over from the old tree.
const projectId = "76a4b2c7-e6dc-40fa-808e-27c1b574d342";

const identity = "dev.schnau.studienbuch";

// The store builds (`@calder-ci/std/Expo` in .calder/ci.ts) stamp a build number into each one. The
// version comes from package.json, which fingerprint.config.js hashes as well.
const { IOS_BUILD_NUMBER, ANDROID_VERSION_CODE } = process.env;

const nunito = (weight: number, name: string) => ({
  weight,
  path: `./node_modules/@expo-google-fonts/nunito/${weight}${name}/Nunito_${weight}${name}.ttf`,
});

// The weights the type tokens use (packages/ui, Tokens.type).
const nunitoFaces = [
  nunito(400, "Regular"),
  nunito(500, "Medium"),
  nunito(600, "SemiBold"),
  nunito(700, "Bold"),
];

export default ({ config }: ConfigContext): ExpoConfig =>
  withPasskeys(
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
      // No over-the-air updates until our own update server runs (D94, M5.16), so no build that
      // reaches pupils asks Expo's servers for one. The fingerprint above still keys the store builds.
      updates: { enabled: false },
      ios: {
        bundleIdentifier: identity,
        // Urbs UG, which owns the App Store account.
        appleTeamId: "2243J9RD68",
        buildNumber: IOS_BUILD_NUMBER ?? "1",
        // Our end-to-end encryption uses only standard algorithms, which Apple counts as exempt. That
        // holds only while the app isn't on the App Store in France, where ANSSI wants a declaration:
        // https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/export-compliance.md
        config: { usesNonExemptEncryption: false },
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
        // `/_sitemap` would list every route, the Sync Lab's too. It stays off on the dev instance
        // as well: the fingerprint hashes this config, so it must not depend on how Expo runs.
        ["expo-router", { sitemap: false }],
        ["expo-sqlite", { useSQLCipher: true }],
        // The backup rules of modules/device-files also leave out the secure store's entries.
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
    }),
    { associatedDomain: process.env.STUDIENBUCH_ASSOCIATED_DOMAIN },
  );

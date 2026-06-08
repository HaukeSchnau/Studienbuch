import { type ConfigPlugin, withAndroidManifest } from "expo/config-plugins";

const IS_DEV = process.env.APP_VARIANT === "development";
const iconSuffix = IS_DEV ? "-dev" : "";
const icon = `./assets/images/icon${iconSuffix}.png`;
const favicon = `./assets/images/favicon${iconSuffix}.png`;
const androidIcon = {
  foregroundImage: `./assets/images/android-icon${iconSuffix}-foreground.png`,
  backgroundImage: `./assets/images/android-icon${iconSuffix}-background.png`,
  monochromeImage: `./assets/images/android-icon${iconSuffix}-monochrome.png`,
};
const splashBackgroundColor = IS_DEV ? "#F8C04E" : "#6DB868";

const androidDevLauncherMetadata = {
  DEV_CLIENT_DEFAULT_LAUNCHER_URL: "http://10.0.2.2:8081",
  EXDevMenuShowFloatingActionButton: "false",
  EXDevMenuShowsAtLaunch: "false",
  EXDevMenuIsOnboardingFinished: "true",
};

const withAndroidDevLauncherMetadata: ConfigPlugin = (config) =>
  withAndroidManifest(config, (manifestConfig) => {
    const application = manifestConfig.modResults.manifest.application?.[0];

    if (!application) {
      return manifestConfig;
    }

    const metadata = application["meta-data"] ?? [];
    application["meta-data"] = metadata;

    Object.entries(androidDevLauncherMetadata).forEach(([name, value]) => {
      const existingEntry = metadata.find((entry) => entry.$?.["android:name"] === name);
      const attributes = {
        "android:name": name,
        "android:value": value,
      };

      if (existingEntry) {
        existingEntry.$ = { ...existingEntry.$, ...attributes };
        return;
      }

      metadata.push({ $: attributes });
    });

    return manifestConfig;
  });

const plugins = [
  "expo-router",
  "expo-image",
  [
    "expo-image-picker",
    {
      photosPermission:
        "Studienbuch darf Fotos auswählen, damit du Aufgaben mit Tafelbildern und Notizen ergänzen kannst.",
      cameraPermission:
        "Studienbuch darf die Kamera öffnen, damit du Aufgaben direkt fotografieren kannst.",
    },
  ],
  ...(IS_DEV
    ? [
        [
          "expo-dev-launcher",
          {
            launchMode: "most-recent",
            showMenuAtLaunch: false,
            skipOnboarding: true,
            toolsButton: false,
            ios: {
              defaultLaunchURL: "http://localhost:8081",
            },
            android: {
              defaultLaunchURL: "http://10.0.2.2:8081",
            },
          },
        ],
        withAndroidDevLauncherMetadata,
      ]
    : []),
  [
    "expo-splash-screen",
    {
      backgroundColor: splashBackgroundColor,
      image: icon,
      imageWidth: 200,
    },
  ],
];

export default {
  expo: {
    name: IS_DEV ? "Studienbuch (Dev)" : "Studienbuch",
    slug: "studienbuch",
    version: "1.0.0",
    orientation: "portrait",
    icon,
    scheme: "studienbuch",
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: IS_DEV ? "dev.schnau.studienbuch.dev" : "dev.schnau.studienbuch",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: androidIcon,
      predictiveBackGestureEnabled: true,
      package: IS_DEV ? "dev.schnau.studienbuch.dev" : "dev.schnau.studienbuch",
    },
    web: {
      output: "static",
      favicon,
    },
    plugins,
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
      inlineModules: {
        watchedDirectories: ["src/native"],
      },
    },
    extra: {
      router: {},
      eas: {
        projectId: "76a4b2c7-e6dc-40fa-808e-27c1b574d342",
      },
    },
  },
  build: {
    development: {
      ios: {
        simulator: true,
      },
    },
  },
};

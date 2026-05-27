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
      predictiveBackGestureEnabled: false,
      package: IS_DEV ? "dev.schnau.studienbuch.dev" : "dev.schnau.studienbuch",
    },
    web: {
      output: "static",
      favicon,
    },
    plugins: [
      "expo-router",
      "expo-image",
      "@react-native-community/datetimepicker",
      [
        "expo-splash-screen",
        {
          backgroundColor: splashBackgroundColor,
          image: icon,
          imageWidth: 200,
        },
      ],
    ],
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

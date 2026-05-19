const IS_DEV = process.env.APP_VARIANT === "development";

export default {
  expo: {
    name: IS_DEV ? "Studienbuch (Dev)" : "Studienbuch",
    slug: "studienbuch",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "studienbuch",
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: IS_DEV ? "dev.schnau.studienbuch.dev" : "dev.schnau.studienbuch",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      package: IS_DEV ? "dev.schnau.studienbuch.dev" : "dev.schnau.studienbuch",
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#6DB868",
          image: "./assets/images/icon.png",
          imageWidth: 200,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
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

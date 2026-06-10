import {
  type ConfigPlugin,
  withAndroidManifest,
  withAppDelegate,
  withInfoPlist,
  withPodfile,
} from "expo/config-plugins";
import { withBuildSourceFile } from "@expo/config-plugins/build/ios/XcodeProjectFile";

const IS_DEV = process.env.APP_VARIANT === "development";
const appVersion = "1.0.0";
const iconSuffix = IS_DEV ? "-dev" : "";
const icon = `./assets/images/icon${iconSuffix}.png`;
const favicon = `./assets/images/favicon${iconSuffix}.png`;
const easProjectId = "76a4b2c7-e6dc-40fa-808e-27c1b574d342";
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

const iosDeploymentTarget = "16.4";
const bundleIdentifier = IS_DEV ? "dev.schnau.studienbuch.dev" : "dev.schnau.studienbuch";
const androidPackage = IS_DEV ? "dev.schnau.studienbuch.dev" : "dev.schnau.studienbuch";

const iosSceneDelegate = `import React
import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else {
      return
    }

    let window = UIWindow(windowScene: windowScene)
    appDelegate.startReactNative(in: window, launchOptions: nil)
    self.window = window

    if let urlContext = connectionOptions.urlContexts.first {
      open(urlContext)
    }

    if let userActivity = connectionOptions.userActivities.first {
      continueUserActivity(userActivity)
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    URLContexts.forEach(open)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    continueUserActivity(userActivity)
  }

  private func open(_ urlContext: UIOpenURLContext) {
    var options: [UIApplication.OpenURLOptionsKey: Any] = [
      .openInPlace: urlContext.options.openInPlace
    ]

    if let sourceApplication = urlContext.options.sourceApplication {
      options[.sourceApplication] = sourceApplication
    }

    if let annotation = urlContext.options.annotation {
      options[.annotation] = annotation
    }

    RCTLinkingManager.application(UIApplication.shared, open: urlContext.url, options: options)
  }

  private func continueUserActivity(_ userActivity: NSUserActivity) {
    RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }
}
`;

const iosPodsDeploymentTargetPatch = `    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        deployment_target = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if deployment_target.nil? || Gem::Version.new(deployment_target) < Gem::Version.new('${iosDeploymentTarget}')
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${iosDeploymentTarget}'
        end
      end
    end
`;

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

const withIosSceneLifecycle: ConfigPlugin = (config) => {
  config = withBuildSourceFile(config, {
    filePath: "SceneDelegate.swift",
    contents: iosSceneDelegate,
    overwrite: true,
  });

  config = withInfoPlist(config, (plistConfig) => {
    plistConfig.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };

    return plistConfig;
  });

  return withAppDelegate(config, (delegateConfig) => {
    if (delegateConfig.modResults.language !== "swift") {
      throw new Error("withIosSceneLifecycle only supports Swift AppDelegate files.");
    }

    let contents = delegateConfig.modResults.contents;

    contents = contents.replace(
      /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s+window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s+factory\.startReactNative\(\n\s+withModuleName: "main",\n\s+in: window,\n\s+launchOptions: launchOptions\)\n#endif\n/,
      "\n",
    );

    if (!contents.includes("configurationForConnecting connectingSceneSession")) {
      contents = contents.replace(
        "\n  // Linking API\n",
        `
  public func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    let configuration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    configuration.delegateClass = SceneDelegate.self
    return configuration
  }

  func startReactNative(in window: UIWindow, launchOptions: [UIApplication.LaunchOptionsKey: Any]?) {
    self.window = window
    reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
  }

  // Linking API
`,
      );
    }

    delegateConfig.modResults.contents = contents;
    return delegateConfig;
  });
};

const withIosPodsDeploymentTarget: ConfigPlugin = (config) =>
  withPodfile(config, (podfileConfig) => {
    if (podfileConfig.modResults.contents.includes("installer.pods_project.targets.each")) {
      return podfileConfig;
    }

    podfileConfig.modResults.contents = podfileConfig.modResults.contents.replace(
      /(\n\s+react_native_post_install\([\s\S]*?\n\s+\)\n)/,
      `$1${iosPodsDeploymentTargetPatch}`,
    );

    return podfileConfig;
  });

const plugins = [
  "expo-router",
  "expo-image",
  [
    "expo-widgets",
    {
      bundleIdentifier: `${bundleIdentifier}.widgets`,
      groupIdentifier: `group.${bundleIdentifier}`,
      frequentUpdates: true,
      widgets: [
        {
          name: "StudienbuchSummaryWidget",
          displayName: "Studienbuch Heute",
          description: "Zeigt offene Aufgaben und die nächste fällige Aufgabe.",
          contentMarginsDisabled: true,
          supportedFamilies: ["systemSmall", "systemMedium"],
        },
        {
          name: "StudienbuchStudySessionActivity",
          displayName: "Lernzeit",
          description: "Begleitet eine laufende Lern- oder Unterrichtseinheit.",
          contentMarginsDisabled: false,
          supportedFamilies: ["systemSmall", "systemMedium"],
        },
      ],
    },
  ],
  withIosSceneLifecycle,
  withIosPodsDeploymentTarget,
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
    version: appVersion,
    runtimeVersion: {
      policy: "appVersion",
    },
    updates: {
      enabled: !IS_DEV,
      url: `https://u.expo.dev/${easProjectId}`,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0,
      useEmbeddedUpdate: true,
      enableBsdiffPatchSupport: true,
      assetPatternsToBeBundled: [
        "assets/images/**/*",
        "src/assets/**/*",
        "../../node_modules/expo-router/assets/**/*",
      ],
    },
    orientation: "portrait",
    icon,
    scheme: "studienbuch",
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier,
      deploymentTarget: iosDeploymentTarget,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: androidIcon,
      predictiveBackGestureEnabled: true,
      package: androidPackage,
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
        projectId: easProjectId,
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

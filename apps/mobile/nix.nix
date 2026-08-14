{
  pkgs,
  nodejs,
}:
let
  lib = pkgs.lib;
  jdk = pkgs.jdk21;
  gradle = pkgs.gradle_8;
  ndkVersion = "27.1.12297006";
  androidPackages = pkgs.androidenv.composeAndroidPackages {
    platformVersions = [ "36" ];
    buildToolsVersions = [
      "36.0.0"
      "35.0.0"
    ];
    cmakeVersions = [ "3.22.1" ];
    includeEmulator = pkgs.stdenv.hostPlatform.system != "aarch64-linux";
    includeNDK = true;
    ndkVersions = [ ndkVersion ];
  };
  androidSdk = androidPackages.androidsdk;
  androidSdkRoot = "${androidSdk}/libexec/android-sdk";
in
{
  development.action = pkgs.writeShellApplication {
    name = "studienbuch-mobile-action";
    runtimeInputs = [
      pkgs.coreutils
      nodejs
    ];
    text = ''
      checkout="$(project-context path checkout)"
      cache_root="$(project-context path cache)"
      mobile_url="$(project-context endpoint mobile url)"
      web_url="$(project-context endpoint web url)"
      mobile_port="$(project-context endpoint mobile listen-port)"
      mobile_cache="$cache_root/mobile"
      install -d -m 0700 "$mobile_cache/tmp"

      export APP_VARIANT=development
      export EXPO_PACKAGER_PROXY_URL="$mobile_url"
      export EXPO_PUBLIC_API_URL="$web_url"
      export EXPO_UNSTABLE_HEADLESS=1
      export NODE_OPTIONS="--dns-result-order=ipv4first''${NODE_OPTIONS:+ $NODE_OPTIONS}"
      export TMPDIR="$mobile_cache/tmp"
      export XDG_CACHE_HOME="$mobile_cache"

      encoded_mobile_url="$(node -p 'encodeURIComponent(process.argv[1])' "$mobile_url")"
      echo "Studienbuch Dev Client: studienbuch://expo-development-client/?url=$encoded_mobile_url"

      cd "$checkout/apps/mobile"
      exec "$checkout/node_modules/.bin/vp" exec expo start \
        --dev-client \
        --scheme studienbuch \
        --localhost \
        --port "$mobile_port"
    '';
  };

  devShell = {
    packages = [
      pkgs.watchman
      jdk
      gradle
      androidSdk
    ]
    ++ lib.optionals pkgs.stdenv.hostPlatform.isDarwin [
      pkgs.fastlane
      pkgs.cocoapods
    ];

    environment = {
      ANDROID_HOME = androidSdkRoot;
      ANDROID_SDK_ROOT = androidSdkRoot;
      ANDROID_NDK_ROOT = "${androidSdkRoot}/ndk/${ndkVersion}";
      JAVA_HOME = "${jdk.home}";
    };
  };
}

{
  pkgs,
  nodejs,
}:
let
  lib = pkgs.lib;
  jdk = pkgs.jdk21;
  gradle = pkgs.gradle_8;
  androidComposition = pkgs.androidenv.composeAndroidPackages {
    platformVersions = [ "36" ];
    buildToolsVersions = [
      "36.0.0"
      "35.0.0"
    ];
    cmakeVersions = [ "3.22.1" ];
    includeEmulator = pkgs.stdenv.hostPlatform.system != "aarch64-linux";
    includeNDK = true;
    ndkVersions = [ "27.1.12297006" ];
  };
  androidSdk = androidComposition.androidsdk;
in
{
  developmentAction = pkgs.writeShellApplication {
    name = "studienbuch-mobile-action";
    runtimeInputs = [
      pkgs.coreutils
      nodejs
    ];
    text = ''
      set -euo pipefail

      checkout="$(project-context path checkout)"
      cache_root="$(project-context path cache)"
      mobile_url="$(project-context endpoint mobile url)"
      mobile_port="$(project-context endpoint mobile listen-port)"
      mobile_cache="$cache_root/mobile"
      install -d -m 0700 "$mobile_cache/tmp"

      export APP_VARIANT=development
      export EXPO_PACKAGER_PROXY_URL="$mobile_url"
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

  devShellPackages = [
    pkgs.watchman
    jdk
    gradle
    androidSdk
  ]
  ++ lib.optionals pkgs.stdenv.hostPlatform.isDarwin [
    pkgs.fastlane
    pkgs.cocoapods
  ];

  devShellEnvironment = {
    ANDROID_HOME = "${androidSdk}/libexec/android-sdk";
    ANDROID_SDK_ROOT = "${androidSdk}/libexec/android-sdk";
    ANDROID_NDK_ROOT = "${androidSdk}/libexec/android-sdk/ndk/27.1.12297006";
    JAVA_HOME = "${jdk.home}";
  };
}

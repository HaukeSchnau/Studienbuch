{ pkgs }:
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

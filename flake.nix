{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nix-infra-modules = {
      url = "github:HaukeSchnau/nix-infra-modules";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      nix-infra-modules,
      ...
    }:
    let
      projectDescriptor = builtins.fromJSON (builtins.readFile ./project.json);
    in
    {
      lib.project = projectDescriptor;
    }
    // flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
            android_sdk.accept_license = true;
          };
        };
        jdk = pkgs.jdk21;
        gradle = pkgs.gradle_8;
        androidComposition = pkgs.androidenv.composeAndroidPackages {
          platformVersions = [ "36" ];
          buildToolsVersions = [
            "36.0.0"
            "35.0.0"
          ];
          cmakeVersions = [ "3.22.1" ];
          includeEmulator = true;
          includeNDK = true;
          ndkVersions = [ "27.1.12297006" ];
        };
        androidSdk = androidComposition.androidsdk;

        prepareAction = pkgs.writeShellApplication {
          name = "studienbuch-prepare-action";
          runtimeInputs = [
            pkgs.bun
            pkgs.coreutils
            pkgs.findutils
          ];
          text = ''
            set -euo pipefail

            checkout="$($PROJECT_RUNTIME_QUERY path checkout)"
            state_root="$($PROJECT_RUNTIME_QUERY path state)"
            preparation_state="$state_root/preparation"
            stamp_file="$preparation_state/dependencies.sha256"
            cd "$checkout"

            dependency_key=$(
              {
                sha256sum bun.lock flake.lock package.json
                find apps packages -type f -name package.json -print0 \
                  | sort -z \
                  | xargs -0 -r sha256sum
              } | sha256sum | cut -d ' ' -f 1
            )

            if [[ -d node_modules && -f "$stamp_file" ]] \
              && [[ "$(<"$stamp_file")" == "$dependency_key" ]]; then
              echo "Studienbuch dependencies are already prepared ($dependency_key)"
              exit 0
            fi

            bun install --frozen-lockfile
            install -d -m 0700 "$preparation_state"
            printf '%s\n' "$dependency_key" > "$stamp_file.next"
            mv "$stamp_file.next" "$stamp_file"
          '';
        };

        webAction = pkgs.writeShellApplication {
          name = "studienbuch-web-action";
          runtimeInputs = [
            pkgs.bun
            pkgs.nodejs_latest
          ];
          text = ''
            set -euo pipefail

            checkout="$($PROJECT_RUNTIME_QUERY path checkout)"
            web_url="$($PROJECT_RUNTIME_QUERY endpoint web url)"
            web_host="$($PROJECT_RUNTIME_QUERY endpoint web listen-host)"
            web_port="$($PROJECT_RUNTIME_QUERY endpoint web listen-port)"

            export BETTER_AUTH_URL="$web_url"
            STUDIENBUCH_WEB_HOST_NAMES="$($PROJECT_RUNTIME_QUERY endpoint web host-names --json)"
            export STUDIENBUCH_WEB_HOST_NAMES
            if better_auth_secret_file="$($PROJECT_RUNTIME_QUERY secret-file betterAuthSecret)"; then
              better_auth_secret_file="$($PROJECT_RUNTIME_QUERY secret-file betterAuthSecret --required)"
              BETTER_AUTH_SECRET="$(<"$better_auth_secret_file")"
              export BETTER_AUTH_SECRET
            fi
            export NODE_OPTIONS="--import ./instrument.server.mjs''${NODE_OPTIONS:+ $NODE_OPTIONS}"

            cd "$checkout/apps/web"
            exec bun run dev:server -- --host "$web_host" --port "$web_port" --strictPort
          '';
        };

        mobileAction = pkgs.writeShellApplication {
          name = "studienbuch-mobile-action";
          runtimeInputs = [
            pkgs.bun
            pkgs.coreutils
            pkgs.nodejs_latest
          ];
          text = ''
            set -euo pipefail

            checkout="$($PROJECT_RUNTIME_QUERY path checkout)"
            cache_root="$($PROJECT_RUNTIME_QUERY path cache)"
            mobile_url="$($PROJECT_RUNTIME_QUERY endpoint mobile url)"
            mobile_port="$($PROJECT_RUNTIME_QUERY endpoint mobile listen-port)"
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
            exec bunx expo start \
              --dev-client \
              --scheme studienbuch \
              --localhost \
              --port "$mobile_port"
          '';
        };

        projectRuntime = nix-infra-modules.lib.projectRuntime.mkDevelopment {
          inherit pkgs;
          descriptorPath = ./project.json;
          actions = {
            prepare = prepareAction;
            web = webAction;
            mobile = mobileAction;
          };
        };
      in
      {
        apps = projectRuntime.apps // {
          default = projectRuntime.apps.dev;
        };

        packages = {
          projectRuntime = projectRuntime.package;
          default = projectRuntime.package;
        };

        checks = projectRuntime.checks;

        devShells.default = pkgs.mkShellNoCC {
          packages = with pkgs; [
            bun
            nodejs_latest
            just
            mprocs
            fastlane
            cocoapods
            watchman
            jdk
            gradle
            androidSdk
          ];

          ANDROID_HOME = "${androidSdk}/libexec/android-sdk";
          ANDROID_SDK_ROOT = "${androidSdk}/libexec/android-sdk";
          ANDROID_NDK_ROOT = "${androidSdk}/libexec/android-sdk/ndk/27.1.12297006";
          JAVA_HOME = "${jdk.home}";
        };
      }
    );
}

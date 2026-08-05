{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
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
        prepare = pkgs.writeShellApplication {
          name = "studienbuch-prepare";
          runtimeInputs = [
            pkgs.bun
            pkgs.coreutils
            pkgs.findutils
          ];
          text = ''
            state_dir="''${PROJECT_STATE_DIR:-''${XDG_STATE_HOME:-$HOME/.local/state}/studienbuch/preparation}"
            stamp_file="$state_dir/dependencies.sha256"

            dependency_key=$(
              {
                sha256sum bun.lock flake.lock package.json
                find apps packages -type f -name package.json -print \
                  | sort \
                  | xargs sha256sum
              } | sha256sum | cut -d ' ' -f 1
            )

            if [[ -d node_modules && -f "$stamp_file" ]] \
              && [[ "$(<"$stamp_file")" == "$dependency_key" ]]; then
              echo "Studienbuch dependencies are already prepared ($dependency_key)"
              exit 0
            fi

            bun install --frozen-lockfile

            mkdir -p "$state_dir"
            printf '%s\n' "$dependency_key" >"$stamp_file.next"
            mv "$stamp_file.next" "$stamp_file"
          '';
        };
        devWeb = pkgs.writeShellApplication {
          name = "studienbuch-dev-web";
          runtimeInputs = [
            pkgs.bun
            pkgs.nodejs_latest
          ];
          text = ''
            : "''${HOST:=127.0.0.1}"
            : "''${PORT:=3000}"

            export HOST PORT
            export NODE_OPTIONS="--import ./instrument.server.mjs''${NODE_OPTIONS:+ $NODE_OPTIONS}"

            cd apps/web
            exec bun run dev:server -- --host "$HOST" --port "$PORT" --strictPort
          '';
        };
      in
      {
        apps = {
          prepare = {
            type = "app";
            program = "${prepare}/bin/studienbuch-prepare";
          };
          dev-web = {
            type = "app";
            program = "${devWeb}/bin/studienbuch-dev-web";
          };
          dev = {
            type = "app";
            program = "${devWeb}/bin/studienbuch-dev-web";
          };
        };

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

{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nix-infra-modules = {
      url = "github:HaukeSchnau/nix-infra-modules/c2998d026da5c5c4403269f2135d94a9e7c1f7cb";
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
        lib = pkgs.lib;
        nodejs = pkgs.nodejs_24;
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

        dependencySource = lib.cleanSourceWith {
          src = ./.;
          filter =
            path: type:
            let
              relative = lib.removePrefix ((toString ./.) + "/") (toString path);
              ignored =
                lib.any (prefix: lib.hasPrefix prefix relative) [
                  ".direnv/"
                  ".git/"
                  ".jj/"
                  "apps/console/node_modules/"
                  "apps/mobile/node_modules/"
                  "apps/web/.output/"
                  "apps/web/node_modules/"
                  "node_modules/"
                  "packages/core/node_modules/"
                  "tmp/"
                ]
                || lib.elem relative [
                  ".direnv"
                  ".git"
                  ".jj"
                  "apps/console/node_modules"
                  "apps/mobile/node_modules"
                  "apps/web/.output"
                  "apps/web/node_modules"
                  "node_modules"
                  "packages/core/node_modules"
                  "tmp"
                ];
            in
            !ignored
            && (
              type == "directory"
              || relative == "bun.lock"
              || relative == "bunfig.toml"
              || relative == "package.json"
              || lib.hasSuffix "/package.json" relative
              || lib.hasPrefix "patches/" relative
            );
        };

        webSource = lib.cleanSourceWith {
          src = ./.;
          filter =
            path: type:
            let
              relative = lib.removePrefix ((toString ./.) + "/") (toString path);
              ignored =
                lib.hasPrefix "apps/web/.output/" relative
                || lib.hasPrefix "apps/web/node_modules/" relative
                || lib.elem relative [
                  "apps/web/.output"
                  "apps/web/README.md"
                  "apps/web/node_modules"
                ];
            in
            !ignored
            && (
              type == "directory"
              || relative == "bun.lock"
              || relative == "bunfig.toml"
              || relative == "package.json"
              || relative == "tsconfig.json"
              || lib.hasPrefix "apps/web/" relative
            );
        };

        webDependencies = pkgs.stdenvNoCC.mkDerivation {
          pname = "studienbuch-web-dependencies";
          version = "0.0.0";
          src = dependencySource;

          nativeBuildInputs = [ pkgs.bun ];
          dontConfigure = true;
          dontFixup = true;

          buildPhase = ''
            runHook preBuild
            export HOME="$TMPDIR/home"
            export XDG_CACHE_HOME="$TMPDIR/cache"
            export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
            mkdir -p "$HOME" "$XDG_CACHE_HOME"
            bun install --frozen-lockfile --ignore-scripts --filter @stu/web --cpu='*' --os='*'
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p "$out"
            cp -R node_modules "$out/node_modules"
            runHook postInstall
          '';

          outputHashAlgo = "sha256";
          outputHashMode = "recursive";
          outputHash = "sha256-n/4zTkfi+mytrNA1Cc3kS29upDqRIhQKhpzTKZkchlg=";
        };

        webApplication = pkgs.stdenvNoCC.mkDerivation {
          pname = "studienbuch-web";
          version = "0.0.0";
          src = webSource;

          nativeBuildInputs = [
            pkgs.bun
            nodejs
          ];

          buildPhase = ''
            runHook preBuild
            ln -s ${webDependencies}/node_modules node_modules
            bun run --cwd apps/web build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p "$out/lib/studienbuch-web"
            cp -R apps/web/.output/. "$out/lib/studienbuch-web/"
            ln -s ${webDependencies}/node_modules "$out/lib/studienbuch-web/node_modules"
            runHook postInstall
          '';
        };

        prepareAction = pkgs.writeShellApplication {
          name = "studienbuch-prepare-action";
          runtimeInputs = [
            pkgs.bun
            pkgs.coreutils
            pkgs.findutils
          ];
          text = ''
            set -euo pipefail

            checkout="$(project-context path checkout)"
            cache_root="$(project-context path cache)"
            preparation_state="$cache_root/preparation"
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
            nodejs
          ];
          text = ''
            set -euo pipefail

            checkout="$(project-context path checkout)"
            web_url="$(project-context endpoint web url)"
            web_host="$(project-context endpoint web listen-host)"
            web_port="$(project-context endpoint web listen-port)"

            export BETTER_AUTH_URL="$web_url"
            STUDIENBUCH_WEB_HOST_NAMES="$(project-context endpoint web host-names --json)"
            export STUDIENBUCH_WEB_HOST_NAMES
            if better_auth_secret_file="$(project-context secret-file betterAuthSecret)"; then
              better_auth_secret_file="$(project-context secret-file betterAuthSecret --required)"
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
            exec bunx expo start \
              --dev-client \
              --scheme studienbuch \
              --localhost \
              --port "$mobile_port"
          '';
        };

        releaseWebAction = pkgs.writeShellApplication {
          name = "studienbuch-release-web-action";
          runtimeInputs = [ nodejs ];
          text = ''
            set -euo pipefail

            web_url="$(project-context endpoint web url)"
            HOST="$(project-context endpoint web listen-host)"
            PORT="$(project-context endpoint web listen-port)"
            BETTER_AUTH_URL="$web_url"
            export HOST PORT BETTER_AUTH_URL
            export NODE_ENV=production

            better_auth_secret_file="$(project-context secret-file betterAuthSecret --required)"
            BETTER_AUTH_SECRET="$(<"$better_auth_secret_file")"
            export BETTER_AUTH_SECRET

            cd ${webApplication}/lib/studienbuch-web
            exec node --import ./server/instrument.server.mjs ./server/index.mjs
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

        projectRelease =
          if pkgs.stdenv.hostPlatform.isLinux then
            nix-infra-modules.lib.projectRuntime.mkServiceRelease {
              inherit pkgs;
              descriptorPath = ./project.json;
              payloads = [ webApplication ];
              actions.web = releaseWebAction;
            }
          else
            null;
      in
      {
        apps = projectRuntime.apps;

        packages = {
          projectRuntime = projectRuntime.package;
          default = projectRuntime.package;
        }
        // lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
          projectRelease = projectRelease.package;
          inherit webApplication;
        };

        checks =
          projectRuntime.checks
          // lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
            projectDescriptor = pkgs.runCommand "studienbuch-project-descriptor-check" { } ''
              ${pkgs.jq}/bin/jq -e '
                .schemaVersion == 2 and
                .project == "studienbuch" and
                (.development.endpoints | keys) == ["mobile", "web"] and
                (.development.workloads | keys) == ["mobile", "web"] and
                .development.workloads.web.secrets == ["betterAuthSecret"] and
                (.development.workloads.mobile.secrets // []) == [] and
                .release.action == "web" and
                .release.health.paths == ["/"]
              ' ${./project.json} >/dev/null
              cmp ${./project.json} ${projectRelease.package}/share/project/descriptor.json
              touch "$out"
            '';
            releaseInterface = projectRelease.checks.interface;
            releasePackage = projectRelease.package;
            inherit webApplication;
            releaseSmoke =
              pkgs.runCommand "studienbuch-release-smoke"
                {
                  nativeBuildInputs = [
                    pkgs.coreutils
                    pkgs.curl
                    pkgs.jq
                  ];
                }
                ''
                  set -euo pipefail

                  root="$TMPDIR/runtime"
                  state="$root/state"
                  runtime="$root/run"
                  secrets="$root/secrets"
                  mkdir -p "$state" "$runtime" "$secrets"
                  printf '%s\n' 'release-smoke-secret-with-sufficient-length' > "$secrets/better-auth-secret"

                  jq -n \
                    --arg state "$state" \
                    --arg runtime "$runtime" \
                    '{
                      schemaVersion: 2,
                      project: "studienbuch",
                      realization: "release",
                      paths: {state: $state, runtime: $runtime},
                      endpoints: {
                        web: {
                          protocol: "http",
                          url: "http://127.0.0.1:32117",
                          listen: {host: "127.0.0.1", port: 32117},
                          hostNames: ["studienbuch.example.test"],
                          visibility: "local"
                        }
                      },
                      parameters: {},
                      secrets: {betterAuthSecret: "better-auth-secret"}
                    }' > "$root/manifest.json"

                  PROJECT_RUNTIME_FILE="$root/manifest.json" \
                    PROJECT_SECRETS_DIR="$secrets" \
                    ${projectRelease.package}/bin/project-release-runtime \
                    > "$root/server.log" 2>&1 &
                  server_pid="$!"
                  cleanup() {
                    kill "$server_pid" 2>/dev/null || true
                    wait "$server_pid" 2>/dev/null || true
                  }
                  trap cleanup EXIT

                  for _ in $(seq 1 60); do
                    if curl --fail --silent --show-error http://127.0.0.1:32117/ > "$root/index.html"; then
                      touch "$out"
                      exit 0
                    fi
                    if ! kill -0 "$server_pid" 2>/dev/null; then
                      cat "$root/server.log" >&2
                      exit 1
                    fi
                    sleep 0.25
                  done

                  cat "$root/server.log" >&2
                  exit 1
                '';
          };

        devShells.default = pkgs.mkShellNoCC {
          packages = with pkgs; [
            bun
            nodejs
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

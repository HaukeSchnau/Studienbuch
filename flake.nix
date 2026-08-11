{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nix-infra-modules = {
      url = "github:HaukeSchnau/nix-infra-modules/3d11957d4d1c585578548c9a66a95be4edb4021d";
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
        pnpm = pkgs.pnpm_11.override { nodejs-slim = nodejs; };
        jdk = pkgs.jdk21;
        gradle = pkgs.gradle_8;
        androidComposition = pkgs.androidenv.composeAndroidPackages {
          platformVersions = [ "36" ];
          buildToolsVersions = [
            "36.0.0"
            "35.0.0"
          ];
          cmakeVersions = [ "3.22.1" ];
          includeEmulator = system != "aarch64-linux";
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
              || relative == "package.json"
              || relative == "pnpm-lock.yaml"
              || relative == "pnpm-workspace.yaml"
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
              || relative == "package.json"
              || relative == "pnpm-lock.yaml"
              || relative == "pnpm-workspace.yaml"
              || relative == "tsconfig.json"
              || lib.hasSuffix "/package.json" relative
              || lib.hasPrefix "apps/web/" relative
              || lib.hasPrefix "patches/" relative
            );
        };

        webDependencies = pkgs.fetchPnpmDeps {
          pname = "studienbuch-web-dependencies";
          version = "0.0.0";
          src = dependencySource;
          inherit pnpm;
          pnpmWorkspaces = [ "@stu/web" ];
          fetcherVersion = 4;
          hash = "sha256-8f9o/YsOLG4fehqJWrGNU0whXjjx+lRcrHpIflRxmPI=";
        };

        webApplication = pkgs.stdenvNoCC.mkDerivation {
          pname = "studienbuch-web";
          version = "0.0.0";
          src = webSource;

          nativeBuildInputs = [
            nodejs
            pnpm
            pkgs.pnpmConfigHook
          ];
          pnpmDeps = webDependencies;
          pnpmWorkspaces = [ "@stu/web" ];

          buildPhase = ''
            runHook preBuild
            "$PWD/node_modules/.bin/vp" run --filter @stu/web build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p "$out/lib/studienbuch-web/apps/web"
            cp -R node_modules "$out/lib/studienbuch-web/node_modules"
            cp -R apps/web/node_modules "$out/lib/studienbuch-web/apps/web/node_modules"
            cp -R apps/web/.output "$out/lib/studienbuch-web/apps/web/.output"
            runHook postInstall
          '';
        };

        prepareAction = pkgs.writeShellApplication {
          name = "studienbuch-prepare-action";
          runtimeInputs = [
            pkgs.coreutils
            pkgs.findutils
            pnpm
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
                sha256sum flake.lock package.json pnpm-lock.yaml pnpm-workspace.yaml
                find apps packages -type f -name package.json -print0 \
                  | sort -z \
                  | xargs -0 -r sha256sum
                if [[ -d patches ]]; then
                  find patches -type f -print0 \
                    | sort -z \
                    | xargs -0 -r sha256sum
                fi
              } | sha256sum | cut -d ' ' -f 1
            )

            if [[ -d node_modules && -f "$stamp_file" ]] \
              && [[ "$(<"$stamp_file")" == "$dependency_key" ]]; then
              echo "Studienbuch dependencies are already prepared ($dependency_key)"
              exit 0
            fi

            pnpm install --frozen-lockfile
            install -d -m 0700 "$preparation_state"
            printf '%s\n' "$dependency_key" > "$stamp_file.next"
            mv "$stamp_file.next" "$stamp_file"
          '';
        };

        webAction = pkgs.writeShellApplication {
          name = "studienbuch-web-action";
          runtimeInputs = [
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
            exec "$checkout/node_modules/.bin/vp" dev \
              --host "$web_host" \
              --port "$web_port" \
              --strictPort
          '';
        };

        mobileAction = pkgs.writeShellApplication {
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

            cd ${webApplication}/lib/studienbuch-web/apps/web/.output
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
          packages =
            with pkgs;
            [
              nodejs
              pnpm
              just
              mprocs
              watchman
              jdk
              gradle
              androidSdk
            ]
            ++ lib.optionals stdenv.hostPlatform.isDarwin [
              fastlane
              cocoapods
            ];

          ANDROID_HOME = "${androidSdk}/libexec/android-sdk";
          ANDROID_SDK_ROOT = "${androidSdk}/libexec/android-sdk";
          ANDROID_NDK_ROOT = "${androidSdk}/libexec/android-sdk/ndk/27.1.12297006";
          JAVA_HOME = "${jdk.home}";
          shellHook = ''
            export PATH="$PWD/node_modules/.bin:$PATH"
          '';
        };
      }
    );
}

{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    process-compose-flake.url = "github:Platonic-Systems/process-compose-flake";
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      process-compose-flake,
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

        projectRuntime = pkgs.writeShellApplication {
          name = "studienbuch-project-runtime";
          runtimeInputs = [
            pkgs.bun
            pkgs.bash
            pkgs.coreutils
            pkgs.findutils
            pkgs.git
            pkgs.jq
            pkgs.nodejs_latest
            pkgs.util-linux
          ];
          text = ''
            set -euo pipefail

            action="''${1:-}"
            if [[ "$#" != 1 ]] || [[ "$action" != "prepare" && "$action" != "web" && "$action" != "metro" ]]; then
              echo "usage: studienbuch-project-runtime <prepare|web|metro>" >&2
              exit 64
            fi

            runtime_file="''${PROJECT_RUNTIME_FILE:-}"
            if [[ -z "$runtime_file" ]]; then
              runtime_root="''${XDG_RUNTIME_DIR:-''${TMPDIR:-/tmp}/studienbuch-$UID}/project"
              state_root="''${XDG_STATE_HOME:-$HOME/.local/state}/studienbuch"
              cache_root="''${XDG_CACHE_HOME:-$HOME/.cache}/studienbuch"
              runtime_file="$runtime_root/runtime.json"
              install -d -m 0700 "$runtime_root" "$state_root" "$cache_root"
              jq -n \
                --arg checkout "$PWD" \
                --arg state "$state_root" \
                --arg cache "$cache_root" \
                --arg runtime "$runtime_root" \
                '{
                  schemaVersion: 1,
                  project: "studienbuch",
                  realization: "development",
                  paths: {
                    checkout: $checkout,
                    state: $state,
                    cache: $cache,
                    runtime: $runtime
                  },
                  endpoints: {
                    web: {
                      url: "http://127.0.0.1:3000",
                      visibility: "local",
                      listen: {host: "127.0.0.1", port: 3000}
                    },
                    metro: {
                      url: "http://127.0.0.1:8081",
                      visibility: "local",
                      listen: {host: "127.0.0.1", port: 8081}
                    }
                  },
                  settings: {},
                  secrets: {}
                }' > "$runtime_file.next"
              mv "$runtime_file.next" "$runtime_file"
            fi

            if ! jq -e '
              .schemaVersion == 1 and
              .project == "studienbuch" and
              .realization == "development" and
              (.paths.checkout | type == "string" and length > 0) and
              (.paths.state | type == "string" and length > 0) and
              (.paths.cache | type == "string" and length > 0) and
              (.paths.runtime | type == "string" and length > 0) and
              (.endpoints | type == "object") and
              (.settings | type == "object") and
              (.secrets | type == "object")
            ' "$runtime_file" >/dev/null; then
              echo "Studienbuch Project Runtime manifest is invalid: $runtime_file" >&2
              exit 65
            fi

            export PROJECT_RUNTIME_FILE="$runtime_file"
            checkout=$(jq -er '.paths.checkout' "$runtime_file")
            state_root=$(jq -er '.paths.state' "$runtime_file")
            cache_root=$(jq -er '.paths.cache' "$runtime_file")
            runtime_root=$(jq -er '.paths.runtime' "$runtime_file")
            install -d -m 0700 "$state_root" "$cache_root" "$runtime_root"
            if [[ -z "''${PROJECT_SECRETS_DIR:-}" ]]; then
              PROJECT_SECRETS_DIR="$runtime_root/secrets"
              install -d -m 0700 "$PROJECT_SECRETS_DIR"
              export PROJECT_SECRETS_DIR
            elif [[ ! -d "$PROJECT_SECRETS_DIR" ]]; then
              echo "Studienbuch Project credential directory is missing: $PROJECT_SECRETS_DIR" >&2
              exit 66
            fi

            read_endpoint() {
              local endpoint="$1"
              if ! jq -e --arg endpoint "$endpoint" '
                .endpoints[$endpoint] |
                (.url | type == "string" and length > 0) and
                (.listen.host == "127.0.0.1") and
                (.listen.port | type == "number" and . >= 1 and . <= 65535)
              ' "$runtime_file" >/dev/null; then
                echo "Studienbuch Project Endpoint is missing or invalid: $endpoint" >&2
                exit 65
              fi
            }

            case "$action" in
              prepare)
                preparation_state="$state_root/preparation"
                stamp_file="$preparation_state/dependencies.sha256"
                cd "$checkout"

                coordination_root="''${XDG_RUNTIME_DIR:-/tmp}/studienbuch-project-runtime-$UID"
                install -d -m 0700 "$coordination_root"
                checkout_key=$(pwd -P | sha256sum | cut -d ' ' -f 1)
                exec 9>"$coordination_root/prepare-$checkout_key.lock"
                flock 9

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
                ;;

              web)
                read_endpoint web
                web_url=$(jq -er '.endpoints.web.url' "$runtime_file")
                web_allowed_hosts=$(jq -er '
                  .endpoints.web.hostNames // [] |
                  map(select(type == "string" and length > 0)) |
                  join(",")
                ' "$runtime_file")
                web_generated_host=$(jq -er '
                  .endpoints.web.hostNames // [] |
                  map(select(type == "string" and length > 0)) |
                  last // ""
                ' "$runtime_file")
                web_host=$(jq -er '.endpoints.web.listen.host' "$runtime_file")
                web_port=$(jq -er '.endpoints.web.listen.port' "$runtime_file")

                export HOST="$web_host"
                export PORT="$web_port"
                export BETTER_AUTH_URL="$web_url"
                if [[ -n "$web_allowed_hosts" ]]; then
                  export STUDIENBUCH_WEB_ALLOWED_HOSTS="$web_allowed_hosts"
                  # Vite reads this built-in variable before loading the
                  # mutable checkout's config, so older workspaces also accept
                  # every hostname supplied by the Project controller.
                  export __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS="$web_generated_host"
                fi
                export NODE_OPTIONS="--import ./instrument.server.mjs''${NODE_OPTIONS:+ $NODE_OPTIONS}"

                better_auth_credential=$(jq -r '.secrets.betterAuthSecret // ""' "$runtime_file")
                if [[ -n "$better_auth_credential" ]]; then
                  better_auth_secret_file="$PROJECT_SECRETS_DIR/$better_auth_credential"
                  if [[ ! -s "$better_auth_secret_file" ]]; then
                    echo "Studienbuch Better Auth credential is missing: $better_auth_secret_file" >&2
                    exit 66
                  fi
                  BETTER_AUTH_SECRET="$(<"$better_auth_secret_file")"
                  export BETTER_AUTH_SECRET
                fi

                cd "$checkout/apps/web"
                exec bun run dev:server -- --host "$HOST" --port "$PORT" --strictPort
                ;;

              metro)
                read_endpoint metro
                metro_url=$(jq -er '.endpoints.metro.url' "$runtime_file")
                metro_port=$(jq -er '.endpoints.metro.listen.port' "$runtime_file")
                metro_cache="$cache_root/metro"
                install -d -m 0700 "$metro_cache/tmp"

                export APP_VARIANT=development
                export EXPO_PACKAGER_PROXY_URL="$metro_url"
                export EXPO_UNSTABLE_HEADLESS=1
                export NODE_OPTIONS="--dns-result-order=ipv4first''${NODE_OPTIONS:+ $NODE_OPTIONS}"
                export TMPDIR="$metro_cache/tmp"
                export XDG_CACHE_HOME="$metro_cache"

                deep_link="studienbuch://expo-development-client/?url=$(jq -rn --arg url "$metro_url" '$url | @uri')"
                echo "Studienbuch Dev Client: $deep_link"

                cd "$checkout/apps/mobile"
                exec bunx expo start \
                  --dev-client \
                  --scheme studienbuch \
                  --localhost \
                  --port "$metro_port"
                ;;
            esac
          '';
        };

        projectPreparation = pkgs.writeShellApplication {
          name = "studienbuch-prepare";
          text = ''
            exec ${projectRuntime}/bin/studienbuch-project-runtime prepare
          '';
        };

        developmentProcesses = (import process-compose-flake.lib { inherit pkgs; }).makeProcessCompose {
          name = "studienbuch-development-processes";
          modules = [
            {
              cli.options = {
                no-server = true;
                ordered-shutdown = true;
              };
              settings.processes = {
                web.command = "${projectRuntime}/bin/studienbuch-project-runtime web";
                metro.command = "${projectRuntime}/bin/studienbuch-project-runtime metro";
              };
            }
          ];
        };

        development = pkgs.writeShellApplication {
          name = "studienbuch-development";
          runtimeInputs = [
            pkgs.coreutils
            pkgs.jq
          ];
          text = ''
            set -euo pipefail

            selected=""
            if [[ "$#" == 2 && "$1" == "--only" ]]; then
              selected="$2"
              if [[ "$selected" != "web" && "$selected" != "metro" ]]; then
                echo "unknown Studienbuch development workload: $selected" >&2
                exit 64
              fi
            elif [[ "$#" != 0 ]]; then
              echo "usage: nix run .#dev [-- --only <web|metro>]" >&2
              exit 64
            fi

            runtime_file="''${PROJECT_RUNTIME_FILE:-}"
            if [[ -n "$runtime_file" ]]; then
              if ! state_root=$(jq -er '
                select(
                  .schemaVersion == 1 and
                  .project == "studienbuch" and
                  .realization == "development"
                ) |
                .paths.state |
                select(type == "string" and length > 0)
              ' "$runtime_file"); then
                echo "Studienbuch Project Runtime manifest is invalid: $runtime_file" >&2
                exit 65
              fi
            else
              state_root="''${XDG_STATE_HOME:-$HOME/.local/state}/studienbuch"
            fi

            log_root="$state_root/process-compose"
            install -d -m 0700 "$log_root"
            export PC_LOG_FILE="$log_root/''${selected:-all}.log"
            if [[ ! -t 1 ]]; then
              export PC_DISABLE_TUI=1
            fi

            if [[ -n "$selected" ]]; then
              exec ${developmentProcesses}/bin/studienbuch-development-processes up "$selected"
            fi
            exec ${developmentProcesses}/bin/studienbuch-development-processes up
          '';
        };

        onlyWorkload =
          workload:
          pkgs.writeShellApplication {
            name = "studienbuch-development-${workload}";
            text = ''
              if [[ "$#" != 0 ]]; then
                echo "usage: nix run .#dev-${workload}" >&2
                exit 64
              fi
              exec ${development}/bin/studienbuch-development --only ${workload}
            '';
          };
      in
      {
        apps = {
          prepare = {
            type = "app";
            program = "${projectPreparation}/bin/studienbuch-prepare";
          };
          dev = {
            type = "app";
            program = "${development}/bin/studienbuch-development";
          };
          dev-web = {
            type = "app";
            program = "${onlyWorkload "web"}/bin/studienbuch-development-web";
          };
          dev-metro = {
            type = "app";
            program = "${onlyWorkload "metro"}/bin/studienbuch-development-metro";
          };
        };

        packages = {
          inherit developmentProcesses projectRuntime;
          default = development;
        };

        checks = {
          projectDescriptor =
            pkgs.runCommand "studienbuch-project-descriptor-check"
              {
                nativeBuildInputs = [ pkgs.jq ];
                descriptor = pkgs.writeText "studienbuch-project.json" (builtins.toJSON projectDescriptor);
              }
              ''
                set -euo pipefail

                jq -e '
                  .schemaVersion == 1 and
                  .project == "studienbuch" and
                  (.secrets | keys) == ["betterAuthSecret"] and
                  .secrets.betterAuthSecret.description == "Secret used to sign Better Auth sessions" and
                  (.development.workloads | keys) == ["web"] and
                  .development.workloads.web.secrets == ["betterAuthSecret"] and
                  (.development.endpoints | keys) == ["metro", "web"] and
                  .development.endpoints.web == {} and
                  .development.endpoints.metro.health.paths == ["/status"]
                ' "$descriptor" >/dev/null

                touch "$out"
              '';

          projectRuntime =
            pkgs.runCommand "studienbuch-project-runtime-check"
              {
                nativeBuildInputs = [
                  pkgs.bash
                  pkgs.coreutils
                  pkgs.findutils
                  pkgs.gnugrep
                  pkgs.jq
                ];
              }
              ''
                set -euo pipefail

                bash -n ${projectRuntime}/bin/studienbuch-project-runtime
                bash -n ${development}/bin/studienbuch-development
                grep -Fq 'flock 9' ${projectRuntime}/bin/studienbuch-project-runtime
                grep -Fq 'log_root="$state_root/process-compose"' ${development}/bin/studienbuch-development

                fixture="$TMPDIR/project-runtime-fixture"
                checkout="$fixture/checkout"
                state="$fixture/state"
                cache="$fixture/cache"
                runtime="$fixture/runtime"
                secrets="$fixture/secrets"
                mkdir -p \
                  "$checkout/apps/mobile" \
                  "$checkout/packages/core" \
                  "$checkout/node_modules" \
                  "$state/preparation" \
                  "$cache" \
                  "$runtime" \
                  "$secrets"
                printf '{}\n' > "$checkout/bun.lock"
                printf '{}\n' > "$checkout/flake.lock"
                printf '{}\n' > "$checkout/package.json"
                printf '{}\n' > "$checkout/apps/mobile/package.json"
                printf '{}\n' > "$checkout/packages/core/package.json"

                dependency_key=$(
                  cd "$checkout"
                  {
                    sha256sum bun.lock flake.lock package.json
                    find apps packages -type f -name package.json -print0 \
                      | sort -z \
                      | xargs -0 -r sha256sum
                  } | sha256sum | cut -d ' ' -f 1
                )
                printf '%s\n' "$dependency_key" > "$state/preparation/dependencies.sha256"

                jq -n \
                  --arg checkout "$checkout" \
                  --arg state "$state" \
                  --arg cache "$cache" \
                  --arg runtime "$runtime" \
                  '{
                    schemaVersion: 1,
                    project: "studienbuch",
                    realization: "development",
                    paths: {
                      checkout: $checkout,
                      state: $state,
                      cache: $cache,
                      runtime: $runtime
                    },
                    endpoints: {},
                    settings: {},
                    secrets: {}
                  }' > "$runtime/runtime.json"

                PROJECT_RUNTIME_FILE="$runtime/runtime.json" \
                  PROJECT_SECRETS_DIR="$secrets" \
                  ${projectRuntime}/bin/studienbuch-project-runtime prepare \
                  > "$fixture/prepare.out"
                grep -Fq "Studienbuch dependencies are already prepared ($dependency_key)" \
                  "$fixture/prepare.out"

                printf '{}\n' > "$runtime/invalid.json"
                set +e
                PROJECT_RUNTIME_FILE="$runtime/invalid.json" \
                  PROJECT_SECRETS_DIR="$secrets" \
                  ${projectRuntime}/bin/studienbuch-project-runtime prepare \
                  > "$fixture/invalid.out" 2> "$fixture/invalid.err"
                invalid_status=$?
                set -e
                test "$invalid_status" -eq 65
                grep -Fq 'Studienbuch Project Runtime manifest is invalid' "$fixture/invalid.err"

                touch "$out"
              '';
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

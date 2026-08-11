{
  pkgs,
  root,
  workspace,
}:
let
  inherit (pkgs) lib;
  inherit (workspace) dependencySource nodejs pnpm;

  webSource = lib.cleanSourceWith {
    src = root;
    filter =
      path: type:
      let
        relative = lib.removePrefix ((toString root) + "/") (toString path);
        ignored =
          lib.any (directory: relative == directory || lib.hasPrefix "${directory}/" relative) [
            "agent-notes"
            "apps/web/.output"
            "apps/web/node_modules"
            "nix"
          ]
          || lib.elem relative [
            "apps/web/nix.nix"
            "apps/web/README.md"
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

  developmentAction = pkgs.writeShellApplication {
    name = "studienbuch-web-action";
    runtimeInputs = [ nodejs ];
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

  releaseAction = pkgs.writeShellApplication {
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

  mkReleaseSmoke =
    projectReleasePackage:
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
          ${projectReleasePackage}/bin/project-release-runtime \
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
in
{
  inherit
    developmentAction
    mkReleaseSmoke
    releaseAction
    webApplication
    ;
}

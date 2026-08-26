{
  pkgs,
  workspace,
}:
let
  inherit (pkgs) lib;
  inherit (workspace.sources) dependencySource;
  inherit (workspace.toolchain) nodejs pnpm;
  manifest = lib.importJSON ./package.json;
  webUntisEnvironment = import ../../nix/webuntis-environment.nix;
  application = {
    workspaceName = manifest.name;
    relativePath = "apps/web";
    pname = "studienbuch-web";
    installRoot = "lib/studienbuch-web";
  };
  applicationPath = "${application.installRoot}/${application.relativePath}";
  pnpmWorkspaces = [
    "@stu/api"
    "@stu/console"
    "@stu/worker"
    application.workspaceName
    "@stu/core"
    "@stu/observability"
    "@stu/server"
  ];
  isProductionPlatform = pkgs.stdenv.hostPlatform.system == "aarch64-linux";
  pnpmInstallFlags = [ "--prod" ];
  # fetchPnpmDeps puts caller flags after its own --force. The actual deployment target can opt
  # back into pnpm's native platform selection instead of fetching every OS/CPU binary package.
  pnpmFetchFlags = pnpmInstallFlags ++ lib.optional isProductionPlatform "--no-force";
  source = workspace.sources.sourceForPackages [
    application.workspaceName
    "@stu/console"
    "@stu/worker"
  ];
  prepareProductionWorkspace = ''
    cp pnpm-lock.web.yaml pnpm-lock.yaml
    cp nix/web-pnpmfile.cjs .pnpmfile.cjs
    yq -y -i \
      '.packages = ["apps/console", "apps/web", "apps/worker", "packages/api", "packages/core", "packages/observability", "packages/server"]
       | .autoInstallPeers = false
       | .resolvePeersFromWorkspaceRoot = false' \
      pnpm-workspace.yaml
  '';

  # Update with the `got:` hash reported by:
  #   nix build .#webApplication
  # after running `just web-lock` for relevant workspace manifest or primary lock changes.
  pnpmDependencyHash =
    if isProductionPlatform then
      "sha256-BHEv5MKR4oPTTxK75Ti4mV11w5oiZjrLtwx3woRjsAI="
    else
      # Nixpkgs' forced fetch is platform-independent; keep it for supported development systems.
      "sha256-6PaVJIdZn4NTtFVrN/CFtrLXT5msU7amWKSus01gBmc=";

  pnpmDeps = pkgs.fetchPnpmDeps {
    pname = "studienbuch-web-dependencies";
    version = "0.0.0";
    src = dependencySource;
    inherit pnpm;
    inherit pnpmWorkspaces;
    pnpmInstallFlags = pnpmFetchFlags;
    postPatch = prepareProductionWorkspace;
    # pnpm installs direct tarball dependencies into the project but does not retain their tarball
    # in the content-addressed store exported by fetchPnpmDeps. Populate it explicitly while this
    # fixed-output derivation still has network access so the application build remains offline.
    postInstall = ''
      pnpm store add https://npm.schnau.dev/webuntis-api/-/webuntis-api-0.2.2.tgz
    '';
    fetcherVersion = 4;
    hash = pnpmDependencyHash;
  };

  webApplication = pkgs.stdenvNoCC.mkDerivation {
    inherit (application) pname;
    version = "0.0.0";
    src = source;

    nativeBuildInputs = [
      pkgs.esbuild
      nodejs
      pnpm
      pkgs.pnpmConfigHook
      pkgs.yq
    ];
    inherit pnpmDeps pnpmInstallFlags pnpmWorkspaces;
    postPatch = prepareProductionWorkspace;

    # The extracted pnpm store and workspace share the Nix build filesystem. Dependencies remain
    # untouched, so hard links avoid cloning hundreds of package trees into this ephemeral build.
    prePnpmInstall = ''
      pnpm config set package-import-method hardlink
    '';

    # pnpmConfigHook recursively rewrites every executable in node_modules. This build calls the
    # Vite JavaScript API with Nix's Node, so the scan and generated shell shims are unnecessary.
    preConfigure = ''
      patchShebangs() { :; }
    '';
    dontPatchShebangs = true;

    buildPhase = ''
      runHook preBuild
      (
        cd ${application.relativePath}
        node --input-type=module --eval \
          'import { createBuilder } from "vite"; const builder = await createBuilder(); await builder.buildApp(); await builder.runDevTools();'
        cp instrument.server.mjs .output/server
      )
      esbuild ${application.relativePath}/instrument.server.mjs \
        --bundle \
        --format=cjs \
        --platform=node \
        --outfile=${application.relativePath}/.output/server/instrument.server.cjs
      esbuild apps/console/src/migrate.ts \
        --bundle \
        --format=esm \
        --platform=node \
        --banner:js='import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' \
        --outfile=${application.relativePath}/.output/server/migrate.mjs
      esbuild apps/console/src/index.ts \
        --bundle \
        --format=esm \
        --platform=node \
        --banner:js='import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' \
        --outfile=${application.relativePath}/.output/server/console.mjs
      esbuild apps/worker/src/once.ts \
        --bundle \
        --format=esm \
        --platform=node \
        --banner:js='import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' \
        --outfile=${application.relativePath}/.output/server/worker-once.mjs
      rm ${application.relativePath}/.output/server/instrument.server.mjs
      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall
      mkdir -p "$out/${applicationPath}"
      cp -R ${application.relativePath}/.output "$out/${applicationPath}/.output"
      # The bundled server has no workspace neighbours, so the Drizzle history ships beside it and
      # the release action points STUDIENBUCH_MIGRATIONS_DIR at this copy.
      cp -R packages/server/drizzle "$out/${applicationPath}/drizzle"
      runHook postInstall
    '';
  };

  developmentAction = pkgs.writeShellApplication {
    name = "studienbuch-web-action";
    runtimeInputs = [ nodejs ];
    text = ''
      checkout="$(project-context path checkout)"
      web_url="$(project-context endpoint web url)"
      web_host="$(project-context endpoint web listen-host)"
      web_port="$(project-context endpoint web listen-port)"

      export BETTER_AUTH_URL="$web_url"
      STUDIENBUCH_WEB_HOST_NAMES="$(project-context endpoint web host-names --json)"
      export STUDIENBUCH_WEB_HOST_NAMES
      if better_auth_secret_file="$(project-context secret-file betterAuthSecret)"; then
        BETTER_AUTH_SECRET="$(<"$better_auth_secret_file")"
        export BETTER_AUTH_SECRET
      fi
      database_host="$(project-context endpoint database listen-host)"
      database_port="$(project-context endpoint database listen-port)"
      DATABASE_URL="postgresql://postgres@$database_host:$database_port/postgres"
      export DATABASE_URL
      export NODE_OPTIONS="--import ./instrument.server.mjs''${NODE_OPTIONS:+ $NODE_OPTIONS}"

      # Development telemetry stays in the local viewer unless a wrapper such as with-motel
      # selects another OTLP sink.
      export STUDIENBUCH_OTEL_ENABLED="''${STUDIENBUCH_OTEL_ENABLED:-true}"
      export OTEL_EXPORTER_OTLP_ENDPOINT="''${OTEL_EXPORTER_OTLP_ENDPOINT:-http://127.0.0.1:24318}"
      export STUDIENBUCH_ENVIRONMENT="''${STUDIENBUCH_ENVIRONMENT:-development}"

      cd "$checkout/${application.relativePath}"
      exec node "$checkout/${application.relativePath}/node_modules/vite/dist/vite/node/cli.js" \
        --host "$web_host" \
        --port "$web_port" \
        --strictPort
    '';
  };

  releaseAction = pkgs.writeShellApplication {
    name = "studienbuch-release-web-action";
    runtimeInputs = [ nodejs ];
    text = ''
      web_url="$(project-context endpoint web url)"
      HOST="$(project-context endpoint web listen-host)"
      PORT="$(project-context endpoint web listen-port)"
      BETTER_AUTH_URL="$web_url"
      export HOST PORT BETTER_AUTH_URL
      export NODE_ENV=production

      # The collector is deliberately local to the host. OTLP exporter
      # failures must never prevent the application from serving requests.
      export STUDIENBUCH_OTEL_ENABLED=true
      export OTEL_EXPORTER_OTLP_ENDPOINT="''${OTEL_EXPORTER_OTLP_ENDPOINT:-http://127.0.0.1:4318}"
      export STUDIENBUCH_ENVIRONMENT=production
      export STUDIENBUCH_VERSION=${lib.escapeShellArg (builtins.baseNameOf (toString webApplication))}
      export STUDIENBUCH_OTEL_EXPORT_INTERVAL="5 seconds"
      export STUDIENBUCH_OTEL_SHUTDOWN_TIMEOUT="3 seconds"

      better_auth_secret_file="$(project-context secret-file betterAuthSecret --required)"
      BETTER_AUTH_SECRET="$(<"$better_auth_secret_file")"
      export BETTER_AUTH_SECRET

      STUDIENBUCH_SMTP_URL_FILE="$(project-context secret-file smtpUrl --required)"
      export STUDIENBUCH_SMTP_URL_FILE
      STUDIENBUCH_EMAIL_FROM="$(project-context parameter authEmailFrom)"
      STUDIENBUCH_PASSKEY_RP_ID="$(project-context parameter passkeyRpId)"
      export STUDIENBUCH_EMAIL_FROM STUDIENBUCH_PASSKEY_RP_ID

      DATABASE_URL="$(project-context parameter databaseUrl)"
      export DATABASE_URL
      # STUDIENBUCH_SENTRY_DSN is read from the deployment environment and inherited by the server
      # process. It is a public client credential served to the browser through the root route
      # loader, so rotating it needs a restart rather than a rebuild.
      export STUDIENBUCH_MIGRATIONS_DIR=${webApplication}/${applicationPath}/drizzle

      cd ${webApplication}/${applicationPath}/.output
      exec node --import ./server/instrument.server.cjs ./server/index.mjs
    '';
  };

  migrationAction = pkgs.writeShellApplication {
    name = "studienbuch-release-migrate-action";
    runtimeInputs = [ nodejs ];
    text = ''
      DATABASE_URL="$(project-context parameter databaseUrl)"
      export DATABASE_URL
      export STUDIENBUCH_MIGRATIONS_DIR=${webApplication}/${applicationPath}/drizzle
      export STUDIENBUCH_OTEL_ENABLED=true
      export OTEL_EXPORTER_OTLP_ENDPOINT="''${OTEL_EXPORTER_OTLP_ENDPOINT:-http://127.0.0.1:4318}"
      export STUDIENBUCH_ENVIRONMENT=production
      export STUDIENBUCH_VERSION=${lib.escapeShellArg (builtins.baseNameOf (toString webApplication))}

      exec node ${webApplication}/${applicationPath}/.output/server/migrate.mjs
    '';
  };

  developmentConsoleAction = pkgs.writeShellApplication {
    name = "studienbuch-development-console-action";
    runtimeInputs = [ nodejs ];
    text = ''
      web_url="$(project-context endpoint web url)"

      export BETTER_AUTH_URL="$web_url"
      ${webUntisEnvironment {
        requiredSecrets = false;
        database = ''
          database_host="$(project-context endpoint database listen-host)"
          database_port="$(project-context endpoint database listen-port)"
          DATABASE_URL="postgresql://postgres@$database_host:$database_port/postgres"
          export DATABASE_URL
        '';
      }}
      export STUDIENBUCH_ENVIRONMENT="''${STUDIENBUCH_ENVIRONMENT:-development}"
      export STUDIENBUCH_OTEL_ENABLED="''${STUDIENBUCH_OTEL_ENABLED:-true}"
      export OTEL_EXPORTER_OTLP_ENDPOINT="''${OTEL_EXPORTER_OTLP_ENDPOINT:-http://127.0.0.1:24318}"

      exec node ${webApplication}/${applicationPath}/.output/server/console.mjs "$@"
    '';
  };

  releaseConsoleAction = pkgs.writeShellApplication {
    name = "studienbuch-release-console-action";
    runtimeInputs = [ nodejs ];
    text = ''
      BETTER_AUTH_URL="$(project-context endpoint web url)"
      export BETTER_AUTH_URL
      ${webUntisEnvironment {
        requiredSecrets = true;
        database = ''
          DATABASE_URL="$(project-context parameter databaseUrl)"
          export DATABASE_URL
        '';
      }}
      export STUDIENBUCH_ENVIRONMENT=production
      export STUDIENBUCH_OTEL_ENABLED=true
      export OTEL_EXPORTER_OTLP_ENDPOINT="''${OTEL_EXPORTER_OTLP_ENDPOINT:-http://127.0.0.1:4318}"
      export STUDIENBUCH_VERSION=${lib.escapeShellArg (builtins.baseNameOf (toString webApplication))}

      exec node ${webApplication}/${applicationPath}/.output/server/console.mjs "$@"
    '';
  };

  maintenanceAction =
    name: job:
    lib.nameValuePair name (
      pkgs.writeShellApplication {
        name = "studienbuch-release-${name}-action";
        runtimeInputs = [ nodejs ];
        text = ''
          ${webUntisEnvironment {
            requiredSecrets = true;
            database = ''
              DATABASE_URL="$(project-context parameter databaseUrl)"
              export DATABASE_URL
            '';
          }}

          export NODE_ENV=production
          export STUDIENBUCH_OTEL_ENABLED=true
          export OTEL_EXPORTER_OTLP_ENDPOINT="''${OTEL_EXPORTER_OTLP_ENDPOINT:-http://127.0.0.1:4318}"
          export STUDIENBUCH_ENVIRONMENT=production
          export STUDIENBUCH_VERSION=${lib.escapeShellArg (builtins.baseNameOf (toString webApplication))}

          exec node ${webApplication}/${applicationPath}/.output/server/worker-once.mjs \
            ${lib.escapeShellArg job}
        '';
      }
    );
in
{
  development.action = developmentAction;
  console = {
    developmentAction = developmentConsoleAction;
    releaseAction = releaseConsoleAction;
  };
  release = {
    action = releaseAction;
    migrationAction = migrationAction;
    payload = webApplication;
    maintenanceActions = builtins.listToAttrs [
      (maintenanceAction "webuntis-directory" "directory")
      (maintenanceAction "webuntis-timetable-hot" "recent-and-near-timetable")
      (maintenanceAction "webuntis-timetable-warm" "far-timetable")
      (maintenanceAction "webuntis-course-rosters" "course-rosters")
    ];
  };
}

{
  pkgs,
  workspace,
}:
let
  inherit (pkgs) lib;
  inherit (workspace.sources) dependencySource;
  inherit (workspace.toolchain) nodejs pnpm;
  manifest = lib.importJSON ./package.json;
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
  releaseRevisionEnvironment = ''
    STUDIENBUCH_REVISION="$(project-context revision 2>/dev/null || true)"
    if [[ -n "$STUDIENBUCH_REVISION" ]]; then
      export STUDIENBUCH_REVISION
    fi
  '';
  # Update with the `got:` hash reported by:
  #   nix build .#webApplication
  # after running `just web-lock` for relevant workspace manifest or primary lock changes.
  pnpmDependencyHash =
    if isProductionPlatform then
      "sha256-sdGQm2IAicw+KlC9vLedJsZwKSdeqxvBH1zjybOby2s="
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

  releaseAction = pkgs.writeShellApplication {
    name = "studienbuch-release-web-action";
    runtimeInputs = [ nodejs ];
    text = ''
      export NODE_ENV=production

      export STUDIENBUCH_VERSION=${lib.escapeShellArg (builtins.baseNameOf (toString webApplication))}
      ${releaseRevisionEnvironment}
      export STUDIENBUCH_OTEL_EXPORT_INTERVAL="5 seconds"
      export STUDIENBUCH_OTEL_SHUTDOWN_TIMEOUT="3 seconds"

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
      export STUDIENBUCH_MIGRATIONS_DIR=${webApplication}/${applicationPath}/drizzle
      export STUDIENBUCH_VERSION=${lib.escapeShellArg (builtins.baseNameOf (toString webApplication))}
      ${releaseRevisionEnvironment}

      exec node ${webApplication}/${applicationPath}/.output/server/migrate.mjs
    '';
  };

  releaseConsoleAction = pkgs.writeShellApplication {
    name = "studienbuch-release-console-action";
    runtimeInputs = [ nodejs ];
    text = ''
      export STUDIENBUCH_VERSION=${lib.escapeShellArg (builtins.baseNameOf (toString webApplication))}
      ${releaseRevisionEnvironment}

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
          export NODE_ENV=production
          export STUDIENBUCH_VERSION=${lib.escapeShellArg (builtins.baseNameOf (toString webApplication))}
          ${releaseRevisionEnvironment}

          exec node ${webApplication}/${applicationPath}/.output/server/worker-once.mjs \
            ${lib.escapeShellArg job}
        '';
      }
    );
in
{
  console = {
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

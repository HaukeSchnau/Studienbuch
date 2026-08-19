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
    application.workspaceName
    "@stu/observability"
    "@stu/server"
  ];
  source = workspace.sources.sourceFor application.workspaceName;

  # Update with the `got:` hash reported by:
  #   nix build .#webApplication
  # after regenerating pnpm-lock.yaml for all workspace manifest changes.
  pnpmDependencyHash = "sha256-VsGjESkVpFqFxyosx8vXzxoVe5CFwgOhRnyLBcKW0o8=";

  pnpmDeps = pkgs.fetchPnpmDeps {
    pname = "studienbuch-web-dependencies";
    version = "0.0.0";
    src = dependencySource;
    inherit pnpm;
    inherit pnpmWorkspaces;
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
    ];
    inherit pnpmDeps pnpmWorkspaces;

    buildPhase = ''
      runHook preBuild
      "$PWD/node_modules/.bin/vp" run --filter ${application.workspaceName} build
      esbuild ${application.relativePath}/instrument.server.mjs \
        --bundle \
        --format=cjs \
        --platform=node \
        --outfile=${application.relativePath}/.output/server/instrument.server.cjs
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

      cd "$checkout/${application.relativePath}"
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
in
{
  development.action = developmentAction;
  release = {
    action = releaseAction;
    payload = webApplication;
  };
}

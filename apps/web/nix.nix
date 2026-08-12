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
  pnpmWorkspaces = [ application.workspaceName ];
  source = workspace.sources.sourceFor application.workspaceName;

  pnpmDeps = pkgs.fetchPnpmDeps {
    pname = "studienbuch-web-dependencies";
    version = "0.0.0";
    src = dependencySource;
    inherit pnpm;
    inherit pnpmWorkspaces;
    fetcherVersion = 4;
    hash = "sha256-8f9o/YsOLG4fehqJWrGNU0whXjjx+lRcrHpIflRxmPI=";
  };

  webApplication = pkgs.stdenvNoCC.mkDerivation {
    inherit (application) pname;
    version = "0.0.0";
    src = source;

    nativeBuildInputs = [
      nodejs
      pnpm
      pkgs.pnpmConfigHook
    ];
    inherit pnpmDeps pnpmWorkspaces;

    buildPhase = ''
      runHook preBuild
      "$PWD/node_modules/.bin/vp" run --filter ${application.workspaceName} build
      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall
      mkdir -p "$out/${applicationPath}"
      cp -R node_modules "$out/${application.installRoot}/node_modules"
      cp -R ${application.relativePath}/node_modules "$out/${applicationPath}/node_modules"
      cp -R ${application.relativePath}/.output "$out/${applicationPath}/.output"
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

      better_auth_secret_file="$(project-context secret-file betterAuthSecret --required)"
      BETTER_AUTH_SECRET="$(<"$better_auth_secret_file")"
      export BETTER_AUTH_SECRET

      cd ${webApplication}/${applicationPath}/.output
      exec node --import ./server/instrument.server.mjs ./server/index.mjs
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

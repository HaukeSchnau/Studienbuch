{
  pkgs,
  lib,
  installWorkspaceDeps,
}:
let
  linuxPkgs = import pkgs.path { system = "aarch64-linux"; };
  nodeBin = "${linuxPkgs.nodejs_22}/bin/node";
  runtimeEnv = [
    "NODE_ENV=production"
    "SSL_CERT_FILE=${linuxPkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
  ];

  repoRoot = ../../../..;
  workspaceSrc = lib.fileset.toSource {
    root = repoRoot;
    fileset = lib.fileset.unions [
      (repoRoot + /package.json)
      (repoRoot + /bun.lock)
      (repoRoot + /bunfig.toml)
      (repoRoot + /turbo.json)
      (repoRoot + /patches)
      (repoRoot + /packages)
      (repoRoot + /tooling)
    ];
  };
  migrationsSrc = lib.fileset.toSource {
    root = repoRoot;
    fileset = lib.fileset.unions [
      (repoRoot + /packages/db/drizzle)
    ];
  };

  mkWorkspaceArtifacts =
    {
      pname,
      buildSnippet,
      installSnippet,
    }:
    pkgs.stdenvNoCC.mkDerivation {
      inherit pname;
      version = "0.1.0";
      src = workspaceSrc;
      nativeBuildInputs = [
        pkgs.bun
        pkgs.coreutils
        pkgs.findutils
        pkgs.nodejs_22
        pkgs.rsync
      ];

      dontConfigure = true;
      dontFixup = true;

      buildPhase = ''
        runHook preBuild

        cp -R "$src"/. .
        chmod -R +w .

        export HOME="$TMPDIR/home"
        export XDG_CACHE_HOME="$TMPDIR/xdg-cache"
        mkdir -p "$HOME" "$XDG_CACHE_HOME" "$TMPDIR/stu-cache"

        ${installWorkspaceDeps}

        ${buildSnippet}

        runHook postBuild
      '';

      installPhase = ''
        runHook preInstall
        mkdir -p "$out"
        ${installSnippet}
        runHook postInstall
      '';
    };

  apiArtifacts = mkWorkspaceArtifacts {
    pname = "studienbuch-api-artifacts";
    buildSnippet = ''
      (
        cd packages/api
        NODE_ENV=production bun ./build/build-node.ts
      )
    '';
    installSnippet = ''
      mkdir -p "$out/dist"
      cp -R packages/api/dist/. "$out/dist/"
    '';
  };

  consoleArtifacts = mkWorkspaceArtifacts {
    pname = "studienbuch-console-artifacts";
    buildSnippet = ''
      (
        cd packages/console
        NODE_ENV=production bun ./build/build-node.ts
      )
    '';
    installSnippet = ''
      mkdir -p "$out/dist"
      cp -R packages/console/dist/. "$out/dist/"
    '';
  };

  nextjsArtifacts = mkWorkspaceArtifacts {
    pname = "studienbuch-nextjs-artifacts";
    buildSnippet = ''
      (
        cd packages/web
        NODE_ENV=production \
        BASE_URL=http://localhost:3000 \
        PORT=3000 \
        NEXT_PUBLIC_DEPLOYMENT_ENV=dev \
        MANAGEMENT_DATABASE_URL=postgresql://stu:stu@localhost:5432/stu \
        PULSAR_URL=rabbitmq-stream://localhost:5552 \
        API_PORT=3001 \
          LINEAR_API_KEY=local \
          CACHE_DIR="$TMPDIR/stu-cache" \
          NEXT_PUBLIC_AXIOM_DATASET=local \
          NEXT_PUBLIC_AXIOM_TOKEN=local \
          bun x next build --experimental-build-mode=compile
      )
    '';
    installSnippet = ''
      mkdir -p "$out/standalone" "$out/static"
      cp -R packages/web/.next/standalone/. "$out/standalone/"
      cp -R packages/web/.next/static/. "$out/static/"
    '';
  };

  adminPanelArtifacts = mkWorkspaceArtifacts {
    pname = "studienbuch-admin-panel-artifacts";
    buildSnippet = ''
      (
        cd packages/admin-panel
        NODE_ENV=production \
        MANAGEMENT_DATABASE_URL=postgresql://stu:stu@localhost:5432/stu \
          bun run build
      )
    '';
    installSnippet = ''
      mkdir -p "$out/.output" "$out/public"
      cp -R packages/admin-panel/.output/. "$out/.output/"
      cp -R packages/admin-panel/public/. "$out/public/"
    '';
  };

  migrationsArtifacts = pkgs.stdenvNoCC.mkDerivation {
    pname = "studienbuch-migrations-artifacts";
    version = "0.1.0";
    src = migrationsSrc;
    dontConfigure = true;
    dontBuild = true;
    dontFixup = true;
    installPhase = ''
      runHook preInstall
      mkdir -p "$out/packages/db"
      cp -R "$src/packages/db/drizzle" "$out/packages/db/drizzle"
      runHook postInstall
    '';
  };

  migrationsEntrypoint = pkgs.writeShellApplication {
    name = "migrate";
    runtimeInputs = [
      linuxPkgs.jq
      linuxPkgs.postgresql
    ];
    text = builtins.readFile ./scripts/migrate.sh;
  };

  runtimeRootfs = pkgs.runCommand "studienbuch-runtime-rootfs" { } ''
    mkdir -p "$out/bin" "$out/tmp" "$out/var/spool/cron/crontabs" "$out/etc" "$out/root"
    ln -s ${linuxPkgs.runtimeShell} "$out/bin/sh"
    chmod 1777 "$out/tmp"
    cat > "$out/etc/passwd" <<'PASSWD'
    root:x:0:0:root:/root:${linuxPkgs.runtimeShell}
    PASSWD
    cat > "$out/etc/group" <<'GROUP'
    root:x:0:
    GROUP
  '';

  apiRootfs = pkgs.runCommand "studienbuch-api-rootfs" { } ''
    mkdir -p "$out/app"
    cp -R ${apiArtifacts}/dist/. "$out/app/"
  '';

  consoleRootfs = pkgs.runCommand "studienbuch-console-rootfs" { } ''
    mkdir -p "$out/app" "$out/bin"
    cp -R ${consoleArtifacts}/dist/. "$out/app/"
    cat > "$out/bin/console" <<'SCRIPT'
    #!${linuxPkgs.runtimeShell}
    cd /app
    exec ${nodeBin} console.js "$@"
    SCRIPT
    chmod +x "$out/bin/console"
  '';

  migrationsRootfs = pkgs.runCommand "studienbuch-migrations-rootfs" { } ''
    mkdir -p "$out/app/packages/db"
    cp -R ${migrationsArtifacts}/packages/db/drizzle "$out/app/packages/db/drizzle"
  '';

  nextjsRootfs = pkgs.runCommand "studienbuch-nextjs-rootfs" { } ''
    mkdir -p "$out/app/packages/web/.next"
    cp -R ${nextjsArtifacts}/standalone/. "$out/app/"
    cp -R ${nextjsArtifacts}/static "$out/app/packages/web/.next/static"
  '';

  adminPanelRootfs = pkgs.runCommand "studienbuch-admin-panel-rootfs" { } ''
    mkdir -p "$out/app/packages/admin-panel"
    cp -R ${adminPanelArtifacts}/.output "$out/app/packages/admin-panel/.output"
    cp -R ${adminPanelArtifacts}/public "$out/app/packages/admin-panel/public"
  '';
in
{
  inherit linuxPkgs nodeBin runtimeEnv runtimeRootfs;
  inherit
    apiRootfs
    consoleRootfs
    migrationsRootfs
    migrationsEntrypoint
    nextjsRootfs
    adminPanelRootfs
    ;
}

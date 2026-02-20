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

  repoRoot = ../../..;
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
        cd packages/nextjs
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
      cp -R packages/nextjs/.next/standalone/. "$out/standalone/"
      cp -R packages/nextjs/.next/static/. "$out/static/"
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

  runtimeRootfs = pkgs.runCommand "studienbuch-runtime-rootfs" { } ''
    mkdir -p "$out/bin" "$out/tmp" "$out/var/spool/cron/crontabs" "$out/etc" "$out/root"
    ln -s ${linuxPkgs.runtimeShell} "$out/bin/sh"
    chmod 1777 "$out/tmp"
    cat > "$out/etc/passwd" <<'EOF'
    root:x:0:0:root:/root:${linuxPkgs.runtimeShell}
    EOF
    cat > "$out/etc/group" <<'EOF'
    root:x:0:
    EOF
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
    mkdir -p "$out/app/packages/db" "$out/bin"
    cp -R ${migrationsArtifacts}/packages/db/drizzle "$out/app/packages/db/drizzle"
    cat > "$out/bin/migrate" <<'SCRIPT'
    #!${linuxPkgs.runtimeShell}
    set -eu

    if [ -z "''${MANAGEMENT_DATABASE_URL:-}" ]; then
      echo "MANAGEMENT_DATABASE_URL is not set" >&2
      exit 1
    fi

    journal_path="/app/packages/db/drizzle/meta/_journal.json"
    if [ ! -f "$journal_path" ]; then
      echo "Missing drizzle journal at $journal_path" >&2
      exit 1
    fi

    psql_bin=${linuxPkgs.postgresql}/bin/psql
    jq_bin=${linuxPkgs.jq}/bin/jq

    "$psql_bin" "$MANAGEMENT_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
    CREATE SCHEMA IF NOT EXISTS stu_internal;
    CREATE TABLE IF NOT EXISTS stu_internal.migrations (
      tag text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
    SQL

    "$jq_bin" -r '.entries | sort_by(.idx) | .[].tag' "$journal_path" | while IFS= read -r tag; do
      sql_path="/app/packages/db/drizzle/$tag.sql"
      if [ ! -f "$sql_path" ]; then
        echo "Missing migration SQL file: $sql_path" >&2
        exit 1
      fi

      already_applied=$("$psql_bin" "$MANAGEMENT_DATABASE_URL" -tA -v ON_ERROR_STOP=1 \
        -c "SELECT 1 FROM stu_internal.migrations WHERE tag = '$tag' LIMIT 1;")
      if [ "$already_applied" = "1" ]; then
        echo "Skipping already applied migration: $tag"
        continue
      fi

      echo "Applying migration: $tag"
      "$psql_bin" "$MANAGEMENT_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
    BEGIN;
    \i $sql_path
    INSERT INTO stu_internal.migrations(tag) VALUES ('$tag');
    COMMIT;
    SQL
    done

    echo "Migrations completed."
    SCRIPT
    chmod +x "$out/bin/migrate"
  '';

  nextjsRootfs = pkgs.runCommand "studienbuch-nextjs-rootfs" { } ''
    mkdir -p "$out/app/packages/nextjs/.next"
    cp -R ${nextjsArtifacts}/standalone/. "$out/app/"
    cp -R ${nextjsArtifacts}/static "$out/app/packages/nextjs/.next/static"
  '';

  adminPanelRootfs = pkgs.runCommand "studienbuch-admin-panel-rootfs" { } ''
    mkdir -p "$out/app/packages/admin-panel"
    cp -R ${adminPanelArtifacts}/.output "$out/app/packages/admin-panel/.output"
    cp -R ${adminPanelArtifacts}/public "$out/app/packages/admin-panel/public"
  '';

  mkImage =
    {
      name,
      contents,
      config,
      extraContents ? [ ],
      includeNode ? true,
      maxLayers ? 14,
    }:
    linuxPkgs.dockerTools.buildLayeredImage {
      inherit name config maxLayers;
      contents = [
        runtimeRootfs
        linuxPkgs.cacert
      ]
      ++ lib.optional includeNode linuxPkgs.nodejs_22
      ++ extraContents
      ++ contents;
      tag = "nix";
      created = "1970-01-01T00:00:01Z";
    };

  apiImage = mkImage {
    name = "studienbuch-api";
    contents = [ apiRootfs ];
    config = {
      Env = runtimeEnv ++ [
        "PORT=80"
        "API_PORT=80"
      ];
      WorkingDir = "/app";
      Entrypoint = [
        nodeBin
        "node.js"
      ];
    };
  };

  consoleCronImage = mkImage {
    name = "studienbuch-console-cron";
    contents = [ consoleRootfs ];
    extraContents = [ linuxPkgs.busybox ];
    config = {
      Env = runtimeEnv;
      WorkingDir = "/app";
      Entrypoint = [
        "${linuxPkgs.busybox}/bin/crond"
        "-f"
        "-l"
        "0"
        "-c"
        "/var/spool/cron/crontabs"
      ];
    };
  };

  migrationsImage = mkImage {
    name = "studienbuch-migrations";
    contents = [ migrationsRootfs ];
    includeNode = false;
    extraContents = [
      linuxPkgs.jq
      linuxPkgs.postgresql
    ];
    config = {
      Env = runtimeEnv;
      WorkingDir = "/app";
      Entrypoint = [ "/bin/migrate" ];
    };
  };

  nextjsImage = mkImage {
    name = "studienbuch-nextjs";
    contents = [ nextjsRootfs ];
    config = {
      Env = runtimeEnv ++ [
        "PORT=80"
      ];
      WorkingDir = "/app/packages/nextjs";
      Entrypoint = [
        nodeBin
        "server.js"
      ];
    };
  };

  adminPanelImage = mkImage {
    name = "studienbuch-admin-panel";
    contents = [ adminPanelRootfs ];
    config = {
      Env = runtimeEnv ++ [
        "PORT=80"
      ];
      WorkingDir = "/app/packages/admin-panel";
      Entrypoint = [
        nodeBin
        ".output/server/index.mjs"
      ];
    };
  };

  mkOciArchive =
    {
      image,
      imageName,
      archiveName,
    }:
    pkgs.runCommand archiveName
      {
        nativeBuildInputs = [ pkgs.skopeo ];
      }
      ''
        skopeo --insecure-policy copy \
          "docker-archive:${image}" \
          "oci-archive:$out:${imageName}:nix"
      '';

  apiOciArchive = mkOciArchive {
    image = apiImage;
    imageName = "studienbuch-api";
    archiveName = "studienbuch-api-nix.oci.tar";
  };

  consoleOciArchive = mkOciArchive {
    image = consoleCronImage;
    imageName = "studienbuch-console-cron";
    archiveName = "studienbuch-console-cron-nix.oci.tar";
  };

  migrationsOciArchive = mkOciArchive {
    image = migrationsImage;
    imageName = "studienbuch-migrations";
    archiveName = "studienbuch-migrations-nix.oci.tar";
  };

  nextjsOciArchive = mkOciArchive {
    image = nextjsImage;
    imageName = "studienbuch-nextjs";
    archiveName = "studienbuch-nextjs-nix.oci.tar";
  };

  adminPanelOciArchive = mkOciArchive {
    image = adminPanelImage;
    imageName = "studienbuch-admin-panel";
    archiveName = "studienbuch-admin-panel-nix.oci.tar";
  };

  ociArchives = pkgs.runCommand "studienbuch-oci-archives" { } ''
    mkdir -p "$out"
    cp ${apiOciArchive} "$out/studienbuch-api-nix.oci.tar"
    cp ${consoleOciArchive} "$out/studienbuch-console-cron-nix.oci.tar"
    cp ${migrationsOciArchive} "$out/studienbuch-migrations-nix.oci.tar"
    cp ${nextjsOciArchive} "$out/studienbuch-nextjs-nix.oci.tar"
    cp ${adminPanelOciArchive} "$out/studienbuch-admin-panel-nix.oci.tar"
  '';
in
{
  "image-api" = apiImage;
  "image-console-cron" = consoleCronImage;
  "image-migrations" = migrationsImage;
  "image-nextjs" = nextjsImage;
  "image-admin-panel" = adminPanelImage;

  "oci-api-archive" = apiOciArchive;
  "oci-console-cron-archive" = consoleOciArchive;
  "oci-migrations-archive" = migrationsOciArchive;
  "oci-nextjs-archive" = nextjsOciArchive;
  "oci-admin-panel-archive" = adminPanelOciArchive;

  "oci-archives" = ociArchives;
}

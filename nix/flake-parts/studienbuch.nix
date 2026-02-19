{...}: {
  perSystem = {
    pkgs,
    lib,
    ...
  }: let
    mkWorkspaceScript = {
      name,
      text,
      runtimeInputs ? [],
    }:
      pkgs.writeShellApplication {
        inherit name text;
        runtimeInputs =
          [
            pkgs.bun
            pkgs.coreutils
            pkgs.git
            pkgs.nodejs_22
          ]
          ++ runtimeInputs;
      };

    repoPrelude = ''
      set -euo pipefail
      if git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
        cd "$git_root"
      fi
    '';

    installWorkspaceDeps = ''
      attempts=0
      until bun install --frozen-lockfile --ignore-scripts; do
        attempts=$((attempts + 1))
        if [ "$attempts" -ge 3 ]; then
          echo "bun install failed after $attempts attempts" >&2
          exit 1
        fi

        echo "bun install failed (attempt $attempts), retrying..." >&2
        sleep 2
      done
    '';

    buildApi = mkWorkspaceScript {
      name = "stu-build-api";
      text = ''
        ${repoPrelude}
        ${installWorkspaceDeps}

        cd packages/api
        NODE_ENV=production bun ./build/build-node.ts
      '';
    };

    buildConsole = mkWorkspaceScript {
      name = "stu-build-console";
      text = ''
        ${repoPrelude}
        ${installWorkspaceDeps}

        cd packages/console
        NODE_ENV=production bun ./build/build-node.ts
      '';
    };

    buildAll = mkWorkspaceScript {
      name = "stu-build-all";
      runtimeInputs = [buildApi buildConsole];
      text = ''
        ${repoPrelude}

        stu-build-api
        stu-build-console
      '';
    };

    migrate = mkWorkspaceScript {
      name = "stu-migrate";
      text = ''
        ${repoPrelude}
        ${installWorkspaceDeps}

        cd packages/db
        bunx drizzle-kit migrate --config drizzle.config.ts "$@"
      '';
    };

    startApi = mkWorkspaceScript {
      name = "stu-start-api";
      runtimeInputs = [buildApi];
      text = ''
        ${repoPrelude}

        if [ ! -f packages/api/dist/node.js ]; then
          stu-build-api
        fi

        exec node packages/api/dist/node.js "$@"
      '';
    };

    startConsole = mkWorkspaceScript {
      name = "stu-start-console";
      runtimeInputs = [buildConsole];
      text = ''
        ${repoPrelude}

        if [ ! -f packages/console/dist/console.js ]; then
          stu-build-console
        fi

        exec node packages/console/dist/console.js "$@"
      '';
    };

    nodeBaseImageDigest = "sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34";
    nodeBaseImageArch =
      if pkgs.stdenv.hostPlatform.isAarch64
      then "arm64"
      else "amd64";
    nodeBaseImageHash =
      if pkgs.stdenv.hostPlatform.isAarch64
      then "sha256-DhT9Z7Lq3K9ATe3AbPCUGSnFBUSVtIV3oELcb3RZ5eo="
      else "sha256-EsXJmc+L0jaJqJWnvcv2ZLIMbw5DWHrn6q1NzU2l6Is=";
    nodeBaseImage = pkgs.dockerTools.pullImage {
      imageName = "node";
      imageDigest = nodeBaseImageDigest;
      hash = nodeBaseImageHash;
      finalImageName = "node";
      finalImageTag = "22-alpine";
      os = "linux";
      arch = nodeBaseImageArch;
    };

    ociPackages = let
      repoRoot = ../..;
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

      workspaceArtifacts = pkgs.stdenvNoCC.mkDerivation {
        pname = "studienbuch-live-artifacts";
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

          (
            cd packages/api
            NODE_ENV=production bun ./build/build-node.ts
          )

          (
            cd packages/console
            NODE_ENV=production bun ./build/build-node.ts
          )

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

          (
            cd packages/admin-panel
            NODE_ENV=production \
            MANAGEMENT_DATABASE_URL=postgresql://stu:stu@localhost:5432/stu \
              bun run build
          )

          runHook postBuild
        '';

        installPhase = ''
            runHook preInstall

            mkdir -p "$out/api" "$out/console" "$out/migrations" "$out/nextjs" "$out/admin-panel"

            cp -R packages/api/dist "$out/api/dist"
            cp -R packages/console/dist "$out/console/dist"

            cp -R packages/db/drizzle "$out/migrations/drizzle"
            cp -R node_modules "$out/migrations/node_modules"
            find "$out/migrations/node_modules" -xtype l -delete

            cp -R packages/nextjs/.next/standalone "$out/nextjs/standalone"
            cp -R packages/nextjs/.next/static "$out/nextjs/static"

          cp -R packages/admin-panel/.output "$out/admin-panel/.output"
          cp -R packages/admin-panel/public "$out/admin-panel/public"

          runHook postInstall
        '';
      };

      apiRootfs = pkgs.runCommand "studienbuch-api-rootfs" {} ''
        mkdir -p "$out/app"
        cp -R ${workspaceArtifacts}/api/dist/. "$out/app/"
      '';

      consoleRootfs = pkgs.runCommand "studienbuch-console-rootfs" {} ''
        mkdir -p "$out/app" "$out/bin"
        cp -R ${workspaceArtifacts}/console/dist/. "$out/app/"
        cat > "$out/bin/console" <<'SCRIPT'
        #!/bin/sh
        cd /app
        exec /usr/local/bin/node console.js "$@"
        SCRIPT
        chmod +x "$out/bin/console"
      '';

      migrationsRootfs = pkgs.runCommand "studienbuch-migrations-rootfs" {} ''
        mkdir -p "$out/app/packages/db" "$out/app"
        cp -R ${workspaceArtifacts}/migrations/drizzle "$out/app/packages/db/drizzle"
        cp -R ${workspaceArtifacts}/migrations/node_modules "$out/app/node_modules"
        cat > "$out/app/migrate.js" <<'SCRIPT'
        const fs = require("node:fs");
        const path = require("node:path");
        const { Client } = require("pg");

        const dbUrl = process.env.MANAGEMENT_DATABASE_URL;
        if (!dbUrl) {
          console.error("MANAGEMENT_DATABASE_URL is not set");
          process.exit(1);
        }

        const journalPath = "/app/packages/db/drizzle/meta/_journal.json";
        if (!fs.existsSync(journalPath)) {
          console.error(`Missing drizzle journal at ''${journalPath}`);
          process.exit(1);
        }

        const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
        const entries = (journal.entries || []).slice().sort((a, b) => a.idx - b.idx);

        async function run() {
          const client = new Client({ connectionString: dbUrl });
          await client.connect();

          await client.query("CREATE SCHEMA IF NOT EXISTS stu_internal");
          await client.query(`
            CREATE TABLE IF NOT EXISTS stu_internal.migrations (
              tag text PRIMARY KEY,
              applied_at timestamptz NOT NULL DEFAULT now()
            )
          `);

          for (const entry of entries) {
            const sqlPath = path.join("/app/packages/db/drizzle", `''${entry.tag}.sql`);
            if (!fs.existsSync(sqlPath)) {
              throw new Error(`Missing migration SQL file: ''${sqlPath}`);
            }

            const alreadyApplied = await client.query(
              "SELECT 1 FROM stu_internal.migrations WHERE tag = $1",
              [entry.tag],
            );
            if (alreadyApplied.rowCount > 0) {
              console.log(`Skipping already applied migration: ''${entry.tag}`);
              continue;
            }

            const sql = fs.readFileSync(sqlPath, "utf8");
            console.log(`Applying migration: ''${entry.tag}`);
            await client.query("BEGIN");
            try {
              await client.query(sql);
              await client.query(
                "INSERT INTO stu_internal.migrations(tag) VALUES ($1)",
                [entry.tag],
              );
              await client.query("COMMIT");
            } catch (error) {
              await client.query("ROLLBACK");
              throw error;
            }
          }

          await client.end();
          console.log("Migrations completed.");
        }

        run().catch((error) => {
          console.error(error);
          process.exit(1);
        });
        SCRIPT
      '';

      nextjsRootfs = pkgs.runCommand "studienbuch-nextjs-rootfs" {} ''
        mkdir -p "$out/app/packages/nextjs/.next"
        cp -R ${workspaceArtifacts}/nextjs/standalone/. "$out/app/"
        cp -R ${workspaceArtifacts}/nextjs/static "$out/app/packages/nextjs/.next/static"
      '';

      adminPanelRootfs = pkgs.runCommand "studienbuch-admin-panel-rootfs" {} ''
        mkdir -p "$out/app/packages/admin-panel"
        cp -R ${workspaceArtifacts}/admin-panel/.output "$out/app/packages/admin-panel/.output"
        cp -R ${workspaceArtifacts}/admin-panel/public "$out/app/packages/admin-panel/public"
      '';

      baseImageEnv = ["NODE_ENV=production"];

      mkImage = {
        name,
        contents,
        config,
      }:
        pkgs.dockerTools.buildLayeredImage {
          inherit name config;
          inherit contents;
          fromImage = nodeBaseImage;
          tag = "nix";
          created = "1970-01-01T00:00:01Z";
        };

      apiImage = mkImage {
        name = "studienbuch-api";
        contents = [apiRootfs];
        config = {
          Env =
            baseImageEnv
            ++ [
              "PORT=80"
              "API_PORT=80"
            ];
          WorkingDir = "/app";
          Entrypoint = ["/usr/local/bin/node" "node.js"];
        };
      };

      consoleCronImage = mkImage {
        name = "studienbuch-console-cron";
        contents = [consoleRootfs];
        config = {
          Env = baseImageEnv;
          WorkingDir = "/app";
          Entrypoint = ["crond" "-f" "-l" "0"];
        };
      };

      migrationsImage = mkImage {
        name = "studienbuch-migrations";
        contents = [migrationsRootfs];
        config = {
          Env = baseImageEnv;
          WorkingDir = "/app";
          Entrypoint = ["/usr/local/bin/node" "/app/migrate.js"];
        };
      };

      nextjsImage = mkImage {
        name = "studienbuch-nextjs";
        contents = [nextjsRootfs];
        config = {
          Env =
            baseImageEnv
            ++ [
              "PORT=80"
            ];
          WorkingDir = "/app/packages/nextjs";
          Entrypoint = ["/usr/local/bin/node" "server.js"];
        };
      };

      adminPanelImage = mkImage {
        name = "studienbuch-admin-panel";
        contents = [adminPanelRootfs];
        config = {
          Env =
            baseImageEnv
            ++ [
              "PORT=80"
            ];
          WorkingDir = "/app/packages/admin-panel";
          Entrypoint = ["/usr/local/bin/node" ".output/server/index.mjs"];
        };
      };

      mkOciArchive = {
        image,
        imageName,
        archiveName,
      }:
        pkgs.runCommand archiveName {
          nativeBuildInputs = [pkgs.skopeo];
        } ''
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

      ociArchives = pkgs.runCommand "studienbuch-oci-archives" {} ''
        mkdir -p "$out"
        cp ${apiOciArchive} "$out/studienbuch-api-nix.oci.tar"
        cp ${consoleOciArchive} "$out/studienbuch-console-cron-nix.oci.tar"
        cp ${migrationsOciArchive} "$out/studienbuch-migrations-nix.oci.tar"
        cp ${nextjsOciArchive} "$out/studienbuch-nextjs-nix.oci.tar"
        cp ${adminPanelOciArchive} "$out/studienbuch-admin-panel-nix.oci.tar"
      '';
    in {
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
    };

    exportOciArchives = mkWorkspaceScript {
      name = "stu-export-oci-archives";
      text = ''
        ${repoPrelude}

        out_dir=''${1:-./.artifacts/oci}
        mkdir -p "$out_dir"
        cp ${ociPackages."oci-archives"}/*.oci.tar "$out_dir"/
      '';
    };

    loadOciArchives = mkWorkspaceScript {
      name = "stu-load-oci-archives";
      runtimeInputs = [pkgs.skopeo];
      text = ''
        ${repoPrelude}

        archive_dir=''${1:-${ociPackages."oci-archives"}}
        api_archive="$archive_dir/studienbuch-api-nix.oci.tar"
        console_archive="$archive_dir/studienbuch-console-cron-nix.oci.tar"
        migrations_archive="$archive_dir/studienbuch-migrations-nix.oci.tar"
        nextjs_archive="$archive_dir/studienbuch-nextjs-nix.oci.tar"
        admin_panel_archive="$archive_dir/studienbuch-admin-panel-nix.oci.tar"

        if [ ! -f "$api_archive" ] || [ ! -f "$console_archive" ] || [ ! -f "$migrations_archive" ] || [ ! -f "$nextjs_archive" ] || [ ! -f "$admin_panel_archive" ]; then
          echo "Missing OCI archives under $archive_dir. Run: nix build .#oci-archives"
          exit 1
        fi

        skopeo --insecure-policy copy "oci-archive:$api_archive" docker-daemon:studienbuch-api:nix
        skopeo --insecure-policy copy "oci-archive:$console_archive" docker-daemon:studienbuch-console-cron:nix
        skopeo --insecure-policy copy "oci-archive:$migrations_archive" docker-daemon:studienbuch-migrations:nix
        skopeo --insecure-policy copy "oci-archive:$nextjs_archive" docker-daemon:studienbuch-nextjs:nix
        skopeo --insecure-policy copy "oci-archive:$admin_panel_archive" docker-daemon:studienbuch-admin-panel:nix
      '';
    };

    basePackages = {
      "build-api" = buildApi;
      "build-console" = buildConsole;
      "build-all" = buildAll;
      "oci-export-archives" = exportOciArchives;
      "oci-load-archives" = loadOciArchives;
      migrations = migrate;
      "start-api" = startApi;
      "start-console" = startConsole;
      default = buildAll;
    };
  in {
    packages = basePackages // ociPackages;

    apps = {
      "build-api" = {
        type = "app";
        program = "${buildApi}/bin/stu-build-api";
        meta.description = "Build the @stu/api Node bundle with Bun.";
      };
      "build-console" = {
        type = "app";
        program = "${buildConsole}/bin/stu-build-console";
        meta.description = "Build the @stu/console Node bundle with Bun.";
      };
      "build-all" = {
        type = "app";
        program = "${buildAll}/bin/stu-build-all";
        meta.description = "Build both API and console bundles.";
      };
      "oci-export-archives" = {
        type = "app";
        program = "${exportOciArchives}/bin/stu-export-oci-archives";
        meta.description = "Export OCI archives to .artifacts/oci.";
      };
      "oci-load-archives" = {
        type = "app";
        program = "${loadOciArchives}/bin/stu-load-oci-archives";
        meta.description = "Load OCI archives (API, console-cron, migrations, Next.js, TanStack Start) into the local Docker daemon.";
      };
      migrations = {
        type = "app";
        program = "${migrate}/bin/stu-migrate";
        meta.description = "Run Drizzle migrations for @stu/db.";
      };
      "start-api" = {
        type = "app";
        program = "${startApi}/bin/stu-start-api";
        meta.description = "Start the built API server.";
      };
      "start-console" = {
        type = "app";
        program = "${startConsole}/bin/stu-start-console";
        meta.description = "Start the built console CLI.";
      };
    };
  };
}

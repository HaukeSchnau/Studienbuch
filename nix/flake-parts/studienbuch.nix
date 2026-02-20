{ ... }:
{
  perSystem =
    {
      pkgs,
      lib,
      ...
    }:
    let
      mkWorkspaceScript =
        {
          name,
          text,
          runtimeInputs ? [ ],
        }:
        pkgs.writeShellApplication {
          inherit name text;
          runtimeInputs = [
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
        export NPM_CONFIG_REGISTRY="https://npm.schnau.dev/"
        export BUN_CONFIG_REGISTRY="https://npm.schnau.dev/"
        lock_hash="no-lock"
        if [ -f bun.lock ]; then
          lock_hash="$(sha256sum bun.lock | awk '{print $1}')"
        fi
        shared_cache_base="''${STUDIENBUCH_BUN_SHARED_CACHE_BASE:-/tmp/studienbuch-bun-cache}"
        shared_tmp_base="''${STUDIENBUCH_BUN_SHARED_TMP_BASE:-/var/tmp/studienbuch-bun-tmp}"
        shared_install_base="''${STUDIENBUCH_BUN_SHARED_INSTALL_BASE:-/var/tmp/studienbuch-bun-install}"

        choose_writable_dir() {
          candidate="$1"
          fallback="$2"
          if mkdir -p "$candidate" 2>/dev/null && [ -w "$candidate" ]; then
            printf '%s' "$candidate"
          else
            mkdir -p "$fallback"
            printf '%s' "$fallback"
          fi
        }

        cache_dir="$(choose_writable_dir "$shared_cache_base/$lock_hash" "$TMPDIR/bun-cache")"
        bun_tmp_dir="$(choose_writable_dir "$shared_tmp_base/$lock_hash" "$TMPDIR/bun-tmp")"
        bun_install_dir="$(choose_writable_dir "$shared_install_base/$lock_hash" "$TMPDIR/bun-install")"
        xdg_runtime_dir="$(choose_writable_dir "$TMPDIR/xdg-runtime" "$TMPDIR/xdg-runtime")"

        export BUN_CACHE_DIR="''${BUN_CACHE_DIR:-$cache_dir}"
        export BUN_TMPDIR="''${BUN_TMPDIR:-$bun_tmp_dir}"
        export BUN_INSTALL="''${BUN_INSTALL:-$bun_install_dir}"
        export XDG_RUNTIME_DIR="''${XDG_RUNTIME_DIR:-$xdg_runtime_dir}"
        chmod 700 "$XDG_RUNTIME_DIR" 2>/dev/null || true

        attempts=0
        until TMPDIR="$BUN_TMPDIR" bun install --frozen-lockfile --ignore-scripts --cache-dir "$BUN_CACHE_DIR"; do
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
        runtimeInputs = [
          buildApi
          buildConsole
        ];
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
        runtimeInputs = [ buildApi ];
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
        runtimeInputs = [ buildConsole ];
        text = ''
          ${repoPrelude}

          if [ ! -f packages/console/dist/console.js ]; then
            stu-build-console
          fi

          exec node packages/console/dist/console.js "$@"
        '';
      };

      linuxPkgs = import pkgs.path { system = "aarch64-linux"; };
      nodeBin = "${linuxPkgs.nodejs_22}/bin/node";
      runtimeEnv = [
        "NODE_ENV=production"
        "SSL_CERT_FILE=${linuxPkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
      ];

      ociPackages =
        let
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
        };

      exportOciArchives = mkWorkspaceScript {
        name = "stu-export-oci-archives";
        text = ''
          ${repoPrelude}

          out_dir=''${1:-./.artifacts/oci}
          mkdir -p "$out_dir"
          cp "$(nix path-info .#packages.aarch64-linux.oci-api-archive)" "$out_dir/studienbuch-api-nix.oci.tar"
          cp "$(nix path-info .#packages.aarch64-linux.oci-console-cron-archive)" "$out_dir/studienbuch-console-cron-nix.oci.tar"
          cp "$(nix path-info .#packages.aarch64-linux.oci-migrations-archive)" "$out_dir/studienbuch-migrations-nix.oci.tar"
          cp "$(nix path-info .#packages.aarch64-linux.oci-nextjs-archive)" "$out_dir/studienbuch-nextjs-nix.oci.tar"
          cp "$(nix path-info .#packages.aarch64-linux.oci-admin-panel-archive)" "$out_dir/studienbuch-admin-panel-nix.oci.tar"
        '';
      };

      loadOciArchives = mkWorkspaceScript {
        name = "stu-load-oci-archives";
        runtimeInputs = [ pkgs.skopeo ];
        text = ''
          ${repoPrelude}

          archive_dir=''${1:-}
          if [ -n "$archive_dir" ]; then
            api_archive="$archive_dir/studienbuch-api-nix.oci.tar"
            console_archive="$archive_dir/studienbuch-console-cron-nix.oci.tar"
            migrations_archive="$archive_dir/studienbuch-migrations-nix.oci.tar"
            nextjs_archive="$archive_dir/studienbuch-nextjs-nix.oci.tar"
            admin_panel_archive="$archive_dir/studienbuch-admin-panel-nix.oci.tar"

            if [ ! -f "$api_archive" ] || [ ! -f "$console_archive" ] || [ ! -f "$migrations_archive" ] || [ ! -f "$nextjs_archive" ] || [ ! -f "$admin_panel_archive" ]; then
              echo "Missing OCI archives under $archive_dir."
              exit 1
            fi
          else
            api_archive="$(nix path-info .#packages.aarch64-linux.oci-api-archive)"
            console_archive="$(nix path-info .#packages.aarch64-linux.oci-console-cron-archive)"
            migrations_archive="$(nix path-info .#packages.aarch64-linux.oci-migrations-archive)"
            nextjs_archive="$(nix path-info .#packages.aarch64-linux.oci-nextjs-archive)"
            admin_panel_archive="$(nix path-info .#packages.aarch64-linux.oci-admin-panel-archive)"
          fi

          state_dir="''${XDG_STATE_HOME:-$HOME/.local/state}/studienbuch"
          state_file="$state_dir/oci-load-state"
          mkdir -p "$state_dir"
          touch "$state_file"

          load_if_changed() {
            image_name="$1"
            archive_path="$2"
            source_ref="oci-archive:$archive_path"
            target_ref="docker-daemon:$image_name:nix"
            archive_digest="$(sha256sum "$archive_path" | awk '{print $1}')"
            target_digest="$(skopeo inspect --format '{{.Digest}}' "$target_ref" 2>/dev/null || true)"
            previous_entry="$(awk -v image="$image_name" '$1 == image {print $0}' "$state_file" | tail -n1)"
            previous_archive_digest="$(printf '%s\n' "$previous_entry" | awk '{print $2}')"
            previous_target_digest="$(printf '%s\n' "$previous_entry" | awk '{print $3}')"

            if [ -n "$target_digest" ] && [ "$previous_archive_digest" = "$archive_digest" ] && [ "$previous_target_digest" = "$target_digest" ]; then
              echo "Skipping $image_name:nix (archive + daemon digest unchanged)"
              return 0
            fi

            if [ -n "$target_digest" ]; then
              echo "Loading $image_name:nix (daemon digest changed or archive updated)"
            else
              echo "Loading $image_name:nix (not present in daemon)"
            fi

            skopeo --insecure-policy copy "$source_ref" "$target_ref"
            new_target_digest="$(skopeo inspect --format '{{.Digest}}' "$target_ref")"
            awk -v image="$image_name" '$1 != image {print $0}' "$state_file" > "$state_file.tmp"
            printf '%s %s %s\n' "$image_name" "$archive_digest" "$new_target_digest" >> "$state_file.tmp"
            mv "$state_file.tmp" "$state_file"
          }

          load_if_changed "studienbuch-api" "$api_archive"
          load_if_changed "studienbuch-console-cron" "$console_archive"
          load_if_changed "studienbuch-migrations" "$migrations_archive"
          load_if_changed "studienbuch-nextjs" "$nextjs_archive"
          load_if_changed "studienbuch-admin-panel" "$admin_panel_archive"
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
    in
    {
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

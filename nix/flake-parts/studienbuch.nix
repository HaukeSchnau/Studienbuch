{...}: {
  perSystem = {pkgs, ...}: let
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
      bun install --frozen-lockfile --ignore-scripts
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

    buildOciArchives = mkWorkspaceScript {
      name = "stu-build-oci-archives";
      runtimeInputs = [buildAll pkgs.findutils];
      text = ''
        ${repoPrelude}

        platform=''${STU_OCI_PLATFORM:-linux/arm64}
        out_dir=''${1:-./.artifacts/oci}
        tmp_dir="$(mktemp -d)"
        trap 'rm -rf "$tmp_dir"' EXIT

        stu-build-all
        mkdir -p "$out_dir"

        mkdir -p "$tmp_dir/api/app"
        cp -R packages/api/dist/. "$tmp_dir/api/app/"
        cat > "$tmp_dir/api/Dockerfile" <<'EOF'
        FROM node:22-alpine
        WORKDIR /app
        COPY app/ /app/
        ENV NODE_ENV=production
        ENV PORT=80
        ENV API_PORT=80
        ENTRYPOINT ["node", "node.js"]
        EOF
        docker buildx build \
          --platform "$platform" \
          --output "type=oci,dest=$out_dir/studienbuch-api-nix.oci.tar" \
          --file "$tmp_dir/api/Dockerfile" \
          "$tmp_dir/api"

        mkdir -p "$tmp_dir/console/app"
        cp -R packages/console/dist/. "$tmp_dir/console/app/"
        cat > "$tmp_dir/console/Dockerfile" <<'EOF'
        FROM node:22-alpine
        WORKDIR /app
        COPY app/ /app/
        RUN echo 'cd /app && node console.js "$@"' > /bin/console && chmod +x /bin/console
        ENV NODE_ENV=production
        ENTRYPOINT ["crond", "-f", "-l", "0"]
        EOF
        docker buildx build \
          --platform "$platform" \
          --output "type=oci,dest=$out_dir/studienbuch-console-cron-nix.oci.tar" \
          --file "$tmp_dir/console/Dockerfile" \
          "$tmp_dir/console"

        mkdir -p "$tmp_dir/migrations/app/packages/db"
        cp -R packages/db/drizzle "$tmp_dir/migrations/app/packages/db/drizzle"
        cp packages/db/drizzle.config.ts "$tmp_dir/migrations/app/packages/db/drizzle.config.ts"
        cat > "$tmp_dir/migrations/Dockerfile" <<'EOF'
        FROM oven/bun:1-alpine
        WORKDIR /app/packages/db
        RUN bun install -g drizzle-kit drizzle-orm pg
        COPY app/packages/db/drizzle.config.ts /app/packages/db/drizzle.config.ts
        COPY app/packages/db/drizzle /app/packages/db/drizzle
        ENV NODE_ENV=production
        ENTRYPOINT ["drizzle-kit", "migrate", "--config", "/app/packages/db/drizzle.config.ts"]
        EOF
        docker buildx build \
          --platform "$platform" \
          --output "type=oci,dest=$out_dir/studienbuch-migrations-nix.oci.tar" \
          --file "$tmp_dir/migrations/Dockerfile" \
          "$tmp_dir/migrations"
      '';
    };

    exportOciArchives = mkWorkspaceScript {
      name = "stu-export-oci-archives";
      runtimeInputs = [buildOciArchives];
      text = ''
        ${repoPrelude}
        out_dir=''${1:-./.artifacts/oci}
        stu-build-oci-archives "$out_dir"
      '';
    };

    loadOciArchives = mkWorkspaceScript {
      name = "stu-load-oci-archives";
      runtimeInputs = [pkgs.skopeo];
      text = ''
        ${repoPrelude}

        archive_dir=''${1:-./.artifacts/oci}
        api_archive="$archive_dir/studienbuch-api-nix.oci.tar"
        console_archive="$archive_dir/studienbuch-console-cron-nix.oci.tar"
        migrations_archive="$archive_dir/studienbuch-migrations-nix.oci.tar"

        if [ ! -f "$api_archive" ] || [ ! -f "$console_archive" ] || [ ! -f "$migrations_archive" ]; then
          echo "Missing OCI archives under $archive_dir. Run: nix run .#oci-build-archives"
          exit 1
        fi

        skopeo --insecure-policy copy "oci-archive:$api_archive" docker-daemon:studienbuch-api:nix
        skopeo --insecure-policy copy "oci-archive:$console_archive" docker-daemon:studienbuch-console-cron:nix
        skopeo --insecure-policy copy "oci-archive:$migrations_archive" docker-daemon:studienbuch-migrations:nix
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
  in {
    packages = {
      "build-api" = buildApi;
      "build-console" = buildConsole;
      "build-all" = buildAll;
      "oci-build-archives" = buildOciArchives;
      "oci-export-archives" = exportOciArchives;
      "oci-load-archives" = loadOciArchives;
      migrations = migrate;
      "start-api" = startApi;
      "start-console" = startConsole;
      default = buildAll;
    };

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
      "oci-build-archives" = {
        type = "app";
        program = "${buildOciArchives}/bin/stu-build-oci-archives";
        meta.description = "Build local OCI archives for API, console-cron, and migrations.";
      };
      "oci-export-archives" = {
        type = "app";
        program = "${exportOciArchives}/bin/stu-export-oci-archives";
        meta.description = "Export OCI archives to .artifacts/oci.";
      };
      "oci-load-archives" = {
        type = "app";
        program = "${loadOciArchives}/bin/stu-load-oci-archives";
        meta.description = "Load OCI archives into the local Docker daemon.";
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

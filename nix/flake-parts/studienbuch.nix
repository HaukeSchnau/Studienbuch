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
            pkgs.nodejs_22
            pkgs.git
            pkgs.coreutils
          ]
          ++ runtimeInputs;
      };

    repoPrelude = ''
      set -euo pipefail
      if git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
        cd "$git_root"
      fi
    '';

    ensureWorkspaceDeps = ''
      if [ ! -d node_modules ]; then
        echo "node_modules is missing. Installing dependencies with bun..."
        bun install --frozen-lockfile
      fi
    '';

    buildApi = mkWorkspaceScript {
      name = "stu-build-api";
      text = ''
        ${repoPrelude}
        ${ensureWorkspaceDeps}

        cd packages/api
        NODE_ENV=production bun ./build/build-node.ts
      '';
    };

    buildConsole = mkWorkspaceScript {
      name = "stu-build-console";
      text = ''
        ${repoPrelude}
        ${ensureWorkspaceDeps}

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
        ${ensureWorkspaceDeps}

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

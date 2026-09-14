{ pkgs, config, ... }:
let
  tools = import ./nix/toolchain.nix { inherit pkgs; };
  mobile = import ./apps/mobile/nix.nix {
    inherit pkgs;
  };
in
{
  packages = builtins.attrValues tools ++ [
    pkgs.just
    pkgs.python3
    pkgs.stdenv.cc
    (pkgs.lib.getBin pkgs.postgresql_17)
  ];

  profiles.mobile.module = {
    packages = mobile.devShell.packages;
    env = mobile.devShell.environment;
  };

  env = {
    NODE_ENV = "development";
    PGHOST = "127.0.0.1";
    PGPORT = "5432";
    PGUSER = "postgres";
    PGDATABASE = "postgres";
    PGDATA = "${config.devenv.state}/postgres";
    STUDIENBUCH_PG_RUNTIME = "${config.devenv.runtime}/postgres";
    STUDIENBUCH_WEB_HOST = "127.0.0.1";
    STUDIENBUCH_WEB_PORT = "3000";
    STUDIENBUCH_MOBILE_PORT = "8081";
    STUDIENBUCH_ENVIRONMENT = "development";
    EXPO_NO_TELEMETRY = "1";
  };

  enterShell = ''
    ${import ./nix/shell-environment.nix}
    export BETTER_AUTH_URL="''${BETTER_AUTH_URL:-http://localhost:3000}"
    export EXPO_PACKAGER_PROXY_URL="''${EXPO_PACKAGER_PROXY_URL:-http://localhost:8081}"
    export STUDIENBUCH_OTEL_ENABLED="''${STUDIENBUCH_OTEL_ENABLED:-false}"

    if [[ "''${PROJECT_DEVENV_MANAGED:-}" == 1 ]]; then
      PGDATA="$(project-context path state)/postgres"
      PGHOST="$(project-context endpoint database listen-host)"
      PGPORT="$(project-context endpoint database listen-port)"
      STUDIENBUCH_WEB_HOST="$(project-context endpoint web listen-host)"
      STUDIENBUCH_WEB_PORT="$(project-context endpoint web listen-port)"
      STUDIENBUCH_MOBILE_PORT="$(project-context endpoint mobile listen-port)"
      BETTER_AUTH_URL="$(project-context endpoint web url)"
      STUDIENBUCH_WEB_HOST_NAMES="$(project-context endpoint web host-names --json)"
      EXPO_PACKAGER_PROXY_URL="$(project-context endpoint mobile url)"
      STUDIENBUCH_MOBILE_CACHE="$(project-context path cache)/mobile"
      OTEL_EXPORTER_OTLP_ENDPOINT="$(project-context parameter observabilityOtlpEndpoint)"
      STUDIENBUCH_OTEL_ENABLED=true
      STUDIENBUCH_EMAIL_FROM="$(project-context parameter authEmailFrom)"
      STUDIENBUCH_PASSKEY_RP_ID="$(project-context parameter passkeyRpId)"
      export STUDIENBUCH_EMAIL_FROM STUDIENBUCH_PASSKEY_RP_ID
      STUDIENBUCH_INSTANCE_ID="$(project-context instance-id 2>/dev/null || true)"
      export PGDATA PGHOST PGPORT STUDIENBUCH_WEB_HOST STUDIENBUCH_WEB_PORT
      export STUDIENBUCH_MOBILE_PORT BETTER_AUTH_URL STUDIENBUCH_WEB_HOST_NAMES
      export EXPO_PACKAGER_PROXY_URL STUDIENBUCH_MOBILE_CACHE
      export OTEL_EXPORTER_OTLP_ENDPOINT STUDIENBUCH_OTEL_ENABLED STUDIENBUCH_INSTANCE_ID

      if secret_file="$(project-context secret-file betterAuthSecret)"; then
        export BETTER_AUTH_SECRET="$(<"$secret_file")"
      fi
      ${import ./nix/webuntis-environment.nix {
        database = "";
        requiredSecrets = false;
      }}
      unset secret_file webuntis_username_file webuntis_password_file
    fi
    export DATABASE_URL="postgresql://$PGUSER@$PGHOST:$PGPORT/$PGDATABASE"
    export EXPO_PUBLIC_API_URL="$BETTER_AUTH_URL"

  '';

  tasks = {
    "studienbuch:dependencies" = {
      before = [ "devenv:enterShell" ];
      exec = ''
        pnpm install --frozen-lockfile
        # Also repair checkouts previously installed with --ignore-scripts.
        pnpm run prepare
      '';
      execIfModified = [
        "package.json"
        "pnpm-lock.yaml"
        "pnpm-workspace.yaml"
        "apps/*/package.json"
        "packages/*/package.json"
        "scripts/package.json"
        "patches/**"
        "node_modules/.modules.yaml"
      ];
    };
    "studienbuch:database-init" = {
      exec = ''
        install -d -m 0700 "$PGDATA" "$STUDIENBUCH_PG_RUNTIME"
        if [[ ! -f "$PGDATA/PG_VERSION" ]]; then
          initdb --auth=trust --encoding=UTF8 --no-locale --username=postgres --pgdata="$PGDATA"
        fi
      '';
    };
    "studienbuch:migrate" = {
      after = [
        "studienbuch:dependencies"
        "devenv:processes:database"
      ];
      exec = "exec node apps/console/node_modules/tsx/dist/cli.mjs apps/console/src/migrate.ts";
    };
    "studienbuch:console" = {
      after = [ "studienbuch:migrate" ];
      exec = ''exec node apps/console/node_modules/tsx/dist/cli.mjs apps/console/src/index.ts "$@"'';
    };
  };

  scripts.studienbuch-console.exec = config.tasks."studienbuch:console".exec;

  processes = {
    database = {
      after = [ "studienbuch:database-init" ];
      exec = ''
        exec postgres --config-file=/dev/null --data-directory="$PGDATA" \
          --hba-file="$PGDATA/pg_hba.conf" --ident-file="$PGDATA/pg_ident.conf" \
          --listen-addresses="$PGHOST" --port="$PGPORT" \
          --unix-socket-directories="$STUDIENBUCH_PG_RUNTIME"
      '';
      ready.exec = "pg_isready --quiet && psql -qtAc 'SELECT 1' >/dev/null";
      shutdown.signal = 2;
    };
    web = {
      after = [ "studienbuch:migrate" ];
      exec = ''
        export NODE_OPTIONS="--import ./instrument.server.mjs''${NODE_OPTIONS:+ $NODE_OPTIONS}"
        # TODO: Remove this switch when Vite's bundled development mode is stable.
        export STUDIENBUCH_WEB_BUNDLED_DEV="''${STUDIENBUCH_WEB_BUNDLED_DEV:-1}"
        cd apps/web
        exec node node_modules/vite/dist/vite/node/cli.js \
          --host "$STUDIENBUCH_WEB_HOST" --port "$STUDIENBUCH_WEB_PORT" --strictPort
      '';
    };
    mobile = {
      after = [ "studienbuch:dependencies" ];
      exec = ''
        export APP_VARIANT=development EXPO_UNSTABLE_HEADLESS=1
        export NODE_OPTIONS="--dns-result-order=ipv4first''${NODE_OPTIONS:+ $NODE_OPTIONS}"
        export XDG_CACHE_HOME="''${STUDIENBUCH_MOBILE_CACHE:-$DEVENV_DOTFILE/mobile}"
        export TMPDIR="$XDG_CACHE_HOME/tmp"
        install -d -m 0700 "$TMPDIR"
        encoded_url="$(node -p 'encodeURIComponent(process.argv[1])' "$EXPO_PACKAGER_PROXY_URL")"
        echo "Studienbuch Dev Client: studienbuch://expo-development-client/?url=$encoded_url"
        cd apps/mobile
        exec node node_modules/expo/bin/cli start --dev-client --scheme studienbuch \
          --localhost --port "$STUDIENBUCH_MOBILE_PORT"
      '';
    };
    worker = {
      after = [ "studienbuch:migrate" ];
      # Project explicitly starts its background workload. Local CLI users opt in.
      start.enable = false;
      exec = "exec node apps/worker/node_modules/tsx/dist/cli.mjs apps/worker/src/index.ts";
    };
  };
}

# One dev instance per worktree (ADR 0006). devenv allocates every port, starting from the base
# below and counting up past ports in use, so worktrees side by side never collide. The server is the
# one origin: it proxies `/` and `/console` to Vite and `/app` to Metro, as a release serves their
# builds. It takes the same variables as a release (ADR 0004).
{ pkgs, config, ... }:
let
  toolchain = import ./nix/toolchain.nix { inherit pkgs; };
  root = config.devenv.root;
  state = config.env.DEVENV_STATE;
  port = name: toString config.processes.${name}.ports.http.value;
  origin = name: "http://127.0.0.1:${port name}";
  # Garage listens on 127.0.0.1 only, so a fixed key for this bucket is fine.
  bucket = "studienbuch";
  key = {
    id = "GK57d1e2b00c40000000000001";
    secret = "57d1e2b00c400000000000000000000000000000000000000000000000000001";
  };
in
{
  packages = builtins.attrValues toolchain;

  enterShell = ''
    export PATH="$DEVENV_ROOT/node_modules/.bin:$PATH"
  '';

  # Listens on a socket in this worktree's runtime directory only.
  services.postgres = {
    enable = true;
    package = toolchain.postgresql;
    initialDatabases = [ { name = "studienbuch"; } ];
  };

  services.garage = {
    enable = true;
    package = pkgs.garage_2;
    buckets = [ bucket ];
    afterStart = ''
      $GARAGE key info ${key.id} >/dev/null 2>&1 \
        || $GARAGE key import --yes -n studienbuch-dev ${key.id} ${key.secret}
      $GARAGE bucket allow --read --write --owner ${bucket} --key ${key.id}
    '';
  };

  env = {
    STUDIENBUCH_ENVIRONMENT = "development";
    PUBLIC_URL = "http://localhost:${port "server"}";
    PASSKEY_RP_ID = "localhost";
    DATABASE_URL = "postgresql:///studienbuch?host=${config.env.DEVENV_RUNTIME}/postgres";
    AUTH_SECRET_FILE = "${state}/auth-secret";
    S3_ENDPOINT = config.env.GARAGE_S3_ENDPOINT;
    S3_REGION = config.services.garage.region;
    S3_BUCKET = bucket;
    S3_PREFIX = "";
    S3_FORCE_PATH_STYLE = "true";
    S3_ACCESS_KEY_ID = key.id;
    S3_SECRET_ACCESS_KEY = key.secret;
    MAIL_URL = "capture:";
    MAIL_FROM = "Studienbuch <studienbuch@localhost>";
    STUDIENBUCH_DEMO_SCHOOL = "seed";
  };

  tasks."studienbuch:auth-secret" = {
    exec = ''umask 077 && head -c 32 /dev/urandom | base64 > "$AUTH_SECRET_FILE"'';
    status = ''test -s "$AUTH_SECRET_FILE"'';
    before = [ "devenv:processes:server" ];
  };

  tasks."studienbuch:prepare" = {
    exec = "node ${root}/apps/server/src/main.ts prepare";
    after = [ "devenv:processes:postgres" ];
    before = [ "devenv:processes:server" ];
  };

  processes.server = {
    ports.http.allocate = 3000;
    cwd = "${root}/apps/server";
    # Restarts when a file the server imports changes.
    exec = "exec node --watch src/main.ts serve";
    env = {
      HOST = "127.0.0.1";
      PORT = port "server";
      STUDIENBUCH_DEV_WEB_URL = origin "web";
      STUDIENBUCH_DEV_APP_URL = origin "app";
    };
    after = [ "devenv:processes:garage" ];
    ready.http.get = {
      port = config.processes.server.ports.http.value;
      path = "/api/health/ready";
    };
  };

  processes.web = {
    ports.http.allocate = 5173;
    cwd = "${root}/apps/web";
    exec = "exec node_modules/.bin/vp dev --host 127.0.0.1 --port ${port "web"} --strictPort";
  };

  processes.app = {
    ports.http.allocate = 8081;
    cwd = "${root}/apps/app";
    exec = "exec node_modules/.bin/expo start --port ${port "app"}";
    env = {
      EXPO_NO_TELEMETRY = "1";
      EXPO_OFFLINE = "1";
      # `expo start` would otherwise rewrite tsconfig.json.
      EXPO_NO_TYPESCRIPT_SETUP = "1";
    };
  };

  scripts.studienbuch-console = {
    description = "The operator CLI against this worktree's database";
    exec = ''exec node "$DEVENV_ROOT/apps/server/src/main.ts" console "$@"'';
  };
}

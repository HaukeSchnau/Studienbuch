{ pkgs, workspace }:
let
  inherit (workspace.toolchain) nodejs;

  databaseAction = pkgs.writeShellApplication {
    name = "studienbuch-database-action";
    runtimeInputs = [ pkgs.postgresql_17 ];
    text = ''
      state="$(project-context path state)/postgres"
      runtime="$(project-context path runtime)/postgres"
      host="$(project-context endpoint database listen-host)"
      port="$(project-context endpoint database listen-port)"

      install -d -m 0700 "$state" "$runtime"
      if [[ ! -f "$state/PG_VERSION" ]]; then
        initdb --auth=trust --encoding=UTF8 --no-locale --username=postgres --pgdata="$state"
      fi

      exec postgres \
        --config-file=/dev/null \
        --data-directory="$state" \
        --hba-file="$state/pg_hba.conf" \
        --ident-file="$state/pg_ident.conf" \
        --listen-addresses="$host" \
        --port="$port" \
        --unix-socket-directories="$runtime"
    '';
  };

  migrationAction = pkgs.writeShellApplication {
    name = "studienbuch-migration-action";
    runtimeInputs = [
      pkgs.coreutils
      pkgs.postgresql_17
      nodejs
    ];
    text = ''
      checkout="$(project-context path checkout)"
      database_host="$(project-context endpoint database listen-host)"
      database_port="$(project-context endpoint database listen-port)"
      export DATABASE_URL="postgresql://postgres@$database_host:$database_port/postgres"

      for _ in {1..60}; do
        if pg_isready --quiet --host="$database_host" --port="$database_port"; then
          break
        fi
        sleep 1
      done
      pg_isready --quiet --host="$database_host" --port="$database_port"

      cd "$checkout/packages/server"
      exec node "$checkout/packages/server/node_modules/drizzle-kit/bin.cjs" migrate
    '';
  };
in
{
  action = databaseAction;
  inherit migrationAction;
}

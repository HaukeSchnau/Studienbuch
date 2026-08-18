{ pkgs, workspace }:
let
  inherit (workspace.toolchain) pnpm;

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
    runtimeInputs = [ pnpm ];
    text = ''
      checkout="$(project-context path checkout)"
      database_host="$(project-context endpoint database listen-host)"
      database_port="$(project-context endpoint database listen-port)"
      export DATABASE_URL="postgresql://postgres@$database_host:$database_port/postgres"

      cd "$checkout/packages/server"
      exec "$checkout/node_modules/.bin/vp" run db:migrate
    '';
  };
in
{
  action = databaseAction;
  inherit migrationAction;
}

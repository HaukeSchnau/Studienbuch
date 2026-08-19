{
  descriptorPath,
  pkgs,
}:
let
  forRelease =
    {
      projectRelease,
      webApplication,
    }:
    let
      releasePackage = projectRelease.package;
      releaseSmoke =
        pkgs.runCommand "studienbuch-release-smoke"
          {
            nativeBuildInputs = [
              pkgs.coreutils
              pkgs.curl
              pkgs.jq
              pkgs.postgresql_17
              pkgs.python3
            ];
          }
          ''
            set -euo pipefail

            root="$TMPDIR/runtime"
            state="$root/state"
            runtime="$root/run"
            secrets="$root/secrets"
            mkdir -p "$state" "$runtime" "$secrets"
            printf '%s\n' 'release-smoke-secret-with-sufficient-length' > "$secrets/better-auth-secret"
            postgres_root="$root/postgres"
            postgres_socket="$root/postgres-socket"
            mkdir -p "$postgres_socket"
            initdb --auth=trust --no-locale --encoding=UTF8 -D "$postgres_root" >/dev/null
            pg_ctl -D "$postgres_root" -o "-h ''' -k $postgres_socket" -w start >/dev/null
            encoded_postgres_socket="$(printf '%s' "$postgres_socket" | jq -sRr @uri)"
            postgres_user="$(id -un)"
            database_url="postgresql://$postgres_user@/postgres?host=$encoded_postgres_socket"

            ${pkgs.python3}/bin/python - "$root/otlp-paths" "$root/otlp-bodies" <<'PY' &
            import http.server
            import pathlib
            import sys

            paths = pathlib.Path(sys.argv[1])
            bodies = pathlib.Path(sys.argv[2])

            class Collector(http.server.BaseHTTPRequestHandler):
                def do_POST(self):
                    length = int(self.headers.get("content-length", "0"))
                    payload = self.rfile.read(length)
                    with paths.open("a", encoding="utf-8") as output:
                        output.write(f"{self.path}\n")
                    with bodies.open("ab") as output:
                        output.write(payload)
                    self.send_response(200)
                    self.send_header("content-type", "application/x-protobuf")
                    self.end_headers()

                def log_message(self, _format, *_args):
                    pass

            http.server.ThreadingHTTPServer(("127.0.0.1", 24318), Collector).serve_forever()
            PY
            collector_pid="$!"

            jq -n \
              --arg state "$state" \
              --arg runtime "$runtime" \
              --arg databaseUrl "$database_url" \
              '{
                schemaVersion: 2,
                project: "studienbuch",
                realization: "release",
                paths: {state: $state, runtime: $runtime},
                endpoints: {
                  web: {
                    protocol: "http",
                    url: "http://127.0.0.1:32117",
                    listen: {host: "127.0.0.1", port: 32117},
                    hostNames: ["studienbuch.example.test"],
                    visibility: "local"
                  }
                },
                parameters: {databaseUrl: $databaseUrl},
                secrets: {
                  betterAuthSecret: "better-auth-secret"
                }
              }' > "$root/manifest.json"

            PROJECT_RUNTIME_FILE="$root/manifest.json" \
              PROJECT_SECRETS_DIR="$secrets" \
              OTEL_EXPORTER_OTLP_ENDPOINT="http://127.0.0.1:24318" \
              ${releasePackage}/bin/project-release-runtime \
              > "$root/server.log" 2>&1 &
            server_pid="$!"
            cleanup() {
              kill "$server_pid" 2>/dev/null || true
              wait "$server_pid" 2>/dev/null || true
              kill "$collector_pid" 2>/dev/null || true
              wait "$collector_pid" 2>/dev/null || true
              pg_ctl -D "$postgres_root" -m fast -w stop >/dev/null 2>&1 || true
            }
            trap cleanup EXIT

            for _ in $(seq 1 60); do
              if curl --fail --silent --show-error \
                http://127.0.0.1:32117/api/health/live > "$root/live.json" \
                && curl --fail --silent --show-error \
                  http://127.0.0.1:32117/api/health/ready > "$root/ready.json"; then
                break
              fi
              if ! kill -0 "$server_pid" 2>/dev/null; then
                cat "$root/server.log" >&2
                exit 1
              fi
              sleep 0.25
            done

            jq -e '.status == "alive"' "$root/live.json" >/dev/null
            jq -e '.status == "ready"' "$root/ready.json" >/dev/null

            # Readiness only reports "ready" once migrations applied and the database answered, so
            # the schema must exist. Assert it directly: a Release that serves traffic against an
            # unmigrated database is the failure this check exists to prevent.
            psql -h "$postgres_socket" -d postgres -tAc \
              "select to_regclass('public.users') is not null
               and to_regclass('public.studienbuch_migrations') is not null" \
              > "$root/schema.txt"
            grep -qx t "$root/schema.txt"
            curl --fail --silent --show-error \
              http://127.0.0.1:32117/api/observability/v1/canary > "$root/canary.json"
            jq -e '.status == "ok"' "$root/canary.json" >/dev/null

            for _ in $(seq 1 40); do
              if grep -Eq '^/v1/(logs|metrics|traces)$' "$root/otlp-paths" 2>/dev/null; then
                break
              fi
              sleep 0.1
            done
            grep -Eq '^/v1/(logs|metrics|traces)$' "$root/otlp-paths"

            # A client envelope must survive the whole path: same-origin admission, the strict
            # schema, ingestion into the Effect runtime, and OTLP export. Each half of this channel
            # was previously tested alone, which is how the two ends came to disagree about
            # admission and acknowledgement without any test noticing.
            jq -n '{
              schemaVersion: 1,
              serviceName: "studienbuch-web-client",
              serviceVersion: "release-smoke",
              environment: "production",
              sentAtUnixMillis: 1,
              records: [{
                type: "log",
                event: "client.telemetry.canary",
                severity: "info",
                occurredAtUnixMillis: 1,
                attributes: {"telemetry.priority": "high"}
              }]
            }' > "$root/envelope.json"

            curl --fail --silent --show-error \
              --header 'content-type: application/json' \
              --header 'origin: http://127.0.0.1:32117' \
              --data @"$root/envelope.json" \
              http://127.0.0.1:32117/api/observability/v1/telemetry > "$root/ingest.json"
            jq -e '.acceptedRecords == 1' "$root/ingest.json" >/dev/null

            # An envelope posted with no Origin and no session must be refused, or the route is an
            # unauthenticated write into the fleet's telemetry pipeline.
            anonymous_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
              --header 'content-type: application/json' \
              --data @"$root/envelope.json" \
              http://127.0.0.1:32117/api/observability/v1/telemetry)"
            test "$anonymous_status" = 403

            # Force an export cycle, then look for the ingress marker the server annotates onto
            # every client-sourced record.
            curl --fail --silent --show-error \
              http://127.0.0.1:32117/api/observability/v1/canary > /dev/null

            for _ in $(seq 1 60); do
              if grep -qa 'public-client-ingress' "$root/otlp-bodies" 2>/dev/null; then
                break
              fi
              sleep 0.25
            done
            grep -qa 'public-client-ingress' "$root/otlp-bodies"

            kill -TERM "$server_pid"
            stopped=false
            for _ in $(seq 1 50); do
              if ! kill -0 "$server_pid" 2>/dev/null; then
                wait "$server_pid" || true
                stopped=true
                break
              fi
              sleep 0.1
            done

            if [ "$stopped" != true ]; then
              echo "release server did not terminate within five seconds" >&2
              cat "$root/server.log" >&2
              exit 1
            fi

            for signal in logs metrics traces; do
              grep -qx "/v1/$signal" "$root/otlp-paths"
            done
            touch "$out"
          '';
    in
    {
      projectDescriptor = pkgs.runCommand "studienbuch-project-descriptor-check" { } ''
        ${pkgs.jq}/bin/jq -e '
          .schemaVersion == 2 and
          .project == "studienbuch" and
          (.development.endpoints | keys) == ["database", "mobile", "web"] and
          (.development.workloads | keys) == ["database", "migrate", "mobile", "web"] and
          .development.workloads.migrate.kind == "task" and
          .development.workloads.migrate.dependsOn == ["database"] and
          .development.workloads.web.dependsOn == ["migrate"] and
          .development.workloads.web.secrets == ["betterAuthSecret"] and
          (.development.workloads.mobile.secrets // []) == [] and
          (.parameters | keys) == ["databaseUrl"] and
          .release.action == "web" and
          .release.health.paths == ["/api/health/live", "/api/health/ready"] and
          .release.health.startupTimeoutSec == 60 and
          .release.health.intervalSec == 2 and
          .release.health.requestTimeoutSec == 2
        ' ${descriptorPath} >/dev/null
        cmp ${descriptorPath} ${releasePackage}/share/project/descriptor.json
        touch "$out"
      '';
      releaseInterface = projectRelease.checks.interface;
      inherit releasePackage releaseSmoke;
      inherit webApplication;
    };
in
{
  inherit forRelease;
}

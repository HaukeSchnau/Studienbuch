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

            ${pkgs.python3}/bin/python - "$root/otlp-paths" <<'PY' &
            import http.server
            import pathlib
            import sys

            paths = pathlib.Path(sys.argv[1])

            class Collector(http.server.BaseHTTPRequestHandler):
                def do_POST(self):
                    length = int(self.headers.get("content-length", "0"))
                    self.rfile.read(length)
                    with paths.open("a", encoding="utf-8") as output:
                        output.write(f"{self.path}\n")
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
                parameters: {},
                secrets: {betterAuthSecret: "better-auth-secret"}
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
          (.development.endpoints | keys) == ["mobile", "web"] and
          (.development.workloads | keys) == ["mobile", "web"] and
          .development.workloads.web.secrets == ["betterAuthSecret"] and
          (.development.workloads.mobile.secrets // []) == [] and
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

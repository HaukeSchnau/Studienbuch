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
              ${releasePackage}/bin/project-release-runtime \
              > "$root/server.log" 2>&1 &
            server_pid="$!"
            cleanup() {
              kill "$server_pid" 2>/dev/null || true
              wait "$server_pid" 2>/dev/null || true
            }
            trap cleanup EXIT

            for _ in $(seq 1 60); do
              if curl --fail --silent --show-error http://127.0.0.1:32117/ > "$root/index.html"; then
                touch "$out"
                exit 0
              fi
              if ! kill -0 "$server_pid" 2>/dev/null; then
                cat "$root/server.log" >&2
                exit 1
              fi
              sleep 0.25
            done

            cat "$root/server.log" >&2
            exit 1
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
          .release.health.paths == ["/"]
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

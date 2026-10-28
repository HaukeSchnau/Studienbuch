# Runs the bundle the way a host does, with environment variables only, against PostgreSQL 18:
# `prepare`, `verify`, `serve` until readiness reports the revision, then a clean SIGTERM.
{ pkgs, bundle }:
let
  inherit (import ./toolchain.nix { inherit pkgs; }) nodejs postgresql;
in
pkgs.runCommand "studienbuch-server-smoke"
  {
    nativeBuildInputs = [
      nodejs
      postgresql
      pkgs.curl
      pkgs.jq
    ];
  }
  ''
    set -euo pipefail
    fail() { echo "serverSmoke: $*" >&2; exit 1; }

    # A socket only, so a build without the sandbox claims no port of its host.
    export PGDATA=$TMPDIR/postgres PGHOST=$TMPDIR PGUSER=postgres
    initdb --auth=trust --username=postgres --no-sync >/dev/null
    pg_ctl --wait --log=$TMPDIR/postgres.log \
      --options="-c listen_addresses= -c unix_socket_directories=$PGHOST -c fsync=off" start
    trap 'pg_ctl --mode=immediate stop >/dev/null' EXIT
    createdb studienbuch

    export \
      HOST=127.0.0.1 \
      PORT=$(node -e 'const s = require("net").createServer().listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close() })') \
      DATABASE_URL="postgresql:///studienbuch?host=$PGHOST&user=postgres" \
      STUDIENBUCH_ENVIRONMENT=preview \
      STUDIENBUCH_REVISION=smoke-revision
    server="node ${bundle}/server/main.mjs"

    $server prepare
    $server verify

    $server serve &
    pid=$!
    for _ in $(seq 60); do
      curl -sf "http://$HOST:$PORT/api/health/ready" -o ready.json && break
      kill -0 $pid 2>/dev/null || fail "serve exited before it was ready"
      sleep 0.5
    done
    [ -f ready.json ] || fail "not ready after 30 s"
    jq -e '.status == "ready" and .revision == "smoke-revision"' ready.json >/dev/null \
      || fail "readiness reports $(cat ready.json)"

    # The pages come from web/ and app/ beside server/, where main.ts looks for them. Only a
    # navigation, which accepts HTML, falls back to a single-page app's shell.
    for path in / /impressum /console /app/ /app/selbsttest; do
      type=$(curl -sf -H 'accept: text/html' -o /dev/null -w '%{content_type}' \
        "http://$HOST:$PORT$path") || fail "GET $path failed"
      [[ $type == text/html* ]] || fail "GET $path answered $type"
    done

    # serve drains for up to 10 s.
    kill -TERM $pid
    for _ in $(seq 24); do
      kill -0 $pid 2>/dev/null || break
      sleep 0.5
    done
    kill -0 $pid 2>/dev/null && fail "serve still runs 12 s after SIGTERM"
    status=0
    wait $pid || status=$?
    [ $status -eq 0 ] || fail "serve exited with $status on SIGTERM"

    cp ready.json $out
  ''

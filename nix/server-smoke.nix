# Runs the bundle the way a host does, with environment variables only, against PostgreSQL 18:
# `prepare`, `verify`, `serve` until readiness reports the revision, the pages, then a clean SIGTERM.
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
    pg_ctl --wait --timeout=60 --log=$TMPDIR/postgres.log \
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
    origin="http://$HOST:$PORT"
    get() { curl -sS --max-time 5 "$@"; }

    timeout 60 $server prepare || fail "prepare failed"
    timeout 60 $server verify || fail "verify failed"

    $server serve &
    pid=$!
    for _ in $(seq 60); do
      get -f "$origin/api/health/ready" -o ready.json 2>/dev/null && break
      kill -0 $pid 2>/dev/null || fail "serve exited before it was ready"
      sleep 0.5
    done
    [ -f ready.json ] || fail "not ready after 30 s"
    jq -e '.status == "ready" and .revision == "smoke-revision"' ready.json >/dev/null \
      || fail "readiness reports $(cat ready.json)"

    # Each page is the file the bundle holds for it, from web/ and app/ beside server/, where main.ts
    # looks for them. Only a navigation, which accepts HTML, falls back to a single-page app's shell.
    while read -r path file; do
      get -f -H 'accept: text/html' "$origin$path" -o page.html || fail "GET $path failed"
      cmp -s page.html ${bundle}/$file || fail "GET $path did not answer $file"
    done <<'PAGES'
    / web/index.html
    /impressum web/impressum/index.html
    /console web/_shell.html
    /console/schools/7 web/_shell.html
    /app/ app/index.html
    /app/selbsttest app/index.html
    PAGES

    # The store dates every file 1970. Another release whose app/index.html has the same size must
    # not get a 304 for it, as it would with an ETag from size and mtime alone.
    index=${bundle}/app/index.html
    previous=$(printf '"%x-%x"' "$(stat -c %s $index)" "$(( $(stat -c %Y $index) * 1000 ))")
    revalidate() { get -o /dev/null -w '%{http_code}' -H 'accept: text/html' -H "if-none-match: $1" "$origin/app/"; }
    headers=$(get -D - -o /dev/null "$origin/app/" | tr -d '\r')
    etag=$(sed -n 's/^etag: //Ip' <<<"$headers")
    [ "$(revalidate "$previous")" = 200 ] || fail "/app/ answered 304 to $previous"
    [ "$(revalidate "$etag")" = 304 ] || fail "/app/ did not revalidate $etag"
    if grep -qi '^last-modified:' <<<"$headers"; then fail "/app/ sends Last-Modified"; fi

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

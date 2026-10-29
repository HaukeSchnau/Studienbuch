#!/usr/bin/env bash
# Pins the pnpm store of the current pnpm-lock.yaml in nix/pnpm-deps.json: fetches it once with an
# empty hash and records the hash Nix reports. Run it as `vp run nix:update-hash` after the lockfile
# changed. The fetch needs an x86_64-linux builder, which Nix finds through the host's builders.
set -euo pipefail
cd "$(dirname "$0")/.."

file=nix/pnpm-deps.json
attr=.#packages.x86_64-linux.deps
previous=$(cat "$file")
write() { printf '{\n  "key": "%s",\n  "hash": "%s"\n}\n' "$1" "$2" >"$file"; }

key=$(nix eval --raw "$attr.pnpmDepsKey")
write "$key" ""
log=$(nix build --no-link "$attr.pnpmDeps" 2>&1) || true
hash=$(sed -n 's/^ *got: *\(sha256-[A-Za-z0-9+/=]*\)$/\1/p' <<<"$log" | head -n 1)

if [ -z "$hash" ]; then
  printf '%s\n' "$previous" >"$file"
  printf '%s\n' "$log" >&2
  echo "nix:update-hash: the fetch reported no hash, so $file is unchanged" >&2
  exit 1
fi

write "$key" "$hash"
echo "nix:update-hash: $file pins $hash"

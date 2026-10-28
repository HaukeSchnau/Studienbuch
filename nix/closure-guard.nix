# Fails when the bundle stops being architecture-independent or grows past its budget (ADR 0005).
# CI builds it on x86_64, and srv-2 runs it on aarch64 with its own Node.
{ pkgs, bundle }:
let
  closure = pkgs.closureInfo { rootPaths = [ bundle ]; };
  budget = 100 * 1000 * 1000;
in
pkgs.runCommand "studienbuch-closure-guard"
  {
    nativeBuildInputs = [
      pkgs.file
      pkgs.jq
    ];
  }
  ''
    fail() { echo "closureGuard: $*" >&2; exit 1; }

    # A reference would pull a store path built for one architecture, such as Node, into the release.
    references=$(grep -v -x ${bundle} ${closure}/store-paths || true)
    [ -z "$references" ] || fail "the bundle references other store paths:"$'\n'"$references"

    size=$(cat ${closure}/total-nar-size)
    [ "$size" -le ${toString budget} ] \
      || fail "the bundle is $((size / 1000000)) MB, over the budget of ${toString (budget / 1000000)} MB"

    # Native code by its content, whatever the file is called: ELF, Mach-O or PE. WebAssembly is
    # portable and stays allowed.
    native=$(find ${bundle} -type f -print0 | xargs -0 -r file --mime-type --no-pad \
      | grep -E ': application/(x-(executable|sharedlib|pie-executable|object|coredump|mach-binary|dosexec)|vnd\.microsoft\.portable-executable)$' \
      || true)
    addons=$(find ${bundle} -name '*.node')
    [ -z "$native$addons" ] || fail "native code in the bundle:"$'\n'"$native$addons"

    # The server is bundled into one file, so its source maps list the modules inside it.
    maps=$(find ${bundle}/server -name '*.map')
    [ -n "$maps" ] || fail "server/ has no source map to read its modules from"
    client=$(jq -r '.sources[]' $maps \
      | grep -E 'node_modules/(@expo|@react-native|expo|expo-[^/]+|react-native|react-native-[^/]+|metro|metro-[^/]+)/' \
      || true)
    [ -z "$client" ] || fail "the server contains client modules:"$'\n'"$(echo "$client" | head -20)"

    {
      echo "bundle $((size / 1000)) kB, no references, no native code"
      for part in server migrations web app; do
        echo "$part $(du -sk --apparent-size ${bundle}/$part | cut -f1) kB"
      done
    } | tee $out
  ''

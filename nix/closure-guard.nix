# Fails when the bundle stops being architecture-independent or grows past its budget (ADR 0005).
# CI builds it on x86_64, and srv-2 runs it on aarch64 with its own Node.
{ pkgs, bundle }:
let
  inherit (import ./toolchain.nix { inherit pkgs; }) nodejs;
  closure = pkgs.closureInfo { rootPaths = [ bundle ]; };
  budget = 100 * 1000 * 1000;

  # A release runs `node server/main.mjs` without node_modules, so the server may import only Node's
  # builtins, and ws's optional native helpers, which it loads in a try block.
  bareImports = pkgs.writeText "bare-imports.js" ''
    const NodeFS = require("node:fs");
    const { builtinModules } = require("node:module");

    const fail = (message) => {
      console.error("closureGuard: " + message);
      process.exit(1);
    };
    const allowed = new Set([...builtinModules, "bufferutil", "utf-8-validate"]);
    // Rolldown writes static imports at the start of a line, and CommonJS requires through `__require`.
    const forms = [
      /^(?:import|export)\b[^;]*?\bfrom\s*"([^"]+)"/gm,
      /^import\s*"([^"]+)"/gm,
      /\b__require\(\s*"([^"]+)"\s*\)/g,
      /\bimport\(\s*"([^"]+)"\s*\)/g,
    ];
    let seen = 0;
    const unknown = [];
    for (const file of process.argv.slice(2)) {
      const code = NodeFS.readFileSync(file, "utf8");
      for (const form of forms) {
        for (const [, specifier] of code.matchAll(form)) {
          seen += 1;
          const bare = !specifier.startsWith(".") && !specifier.startsWith("/");
          if (bare && !specifier.startsWith("node:") && !allowed.has(specifier)) unknown.push(file + ": " + specifier);
        }
      }
    }
    if (seen === 0) fail("found no imports in " + process.argv.slice(2).join(", "));
    if (unknown.length > 0) fail("the server imports what the bundle doesn't contain:\n" + unknown.join("\n"));
  '';
in
pkgs.runCommand "studienbuch-closure-guard"
  {
    nativeBuildInputs = [
      nodejs
      pkgs.file
      pkgs.jq
    ];
  }
  ''
    set -euo pipefail
    fail() { echo "closureGuard: $*" >&2; exit 1; }
    # grep, but no match is a result, not an error.
    matching() { grep "$@" || [ $? -eq 1 ]; }

    # A reference would pull a store path built for one architecture, such as Node, into the release.
    references=$(matching -v -x ${bundle} ${closure}/store-paths)
    [ -z "$references" ] || fail "the bundle references other store paths:"$'\n'"$references"

    size=$(cat ${closure}/total-nar-size)
    [ "$size" -le ${toString budget} ] \
      || fail "the bundle is $((size / 1000000)) MB, over the budget of ${toString (budget / 1000000)} MB"

    # Native code by its content, whatever the file is called (ELF, Mach-O, PE), and archives, whose
    # contents no check here reads. WebAssembly is portable and stays allowed.
    types=$(find ${bundle} -type f -print0 | xargs -0 file --mime-type --no-pad)
    native=$(matching -E ': application/(x-(executable|sharedlib|pie-executable|object|coredump|mach-binary|dosexec)|vnd\.microsoft\.portable-executable)$' <<<"$types")
    archives=$(matching -E ': application/(zip|gzip|x-gzip|x-tar|x-xz|x-bzip2|zstd|x-zstd|x-7z-compressed|x-rar|vnd\.rar|java-archive|x-archive|x-cpio|x-lzma|x-lzip|x-compress)$' <<<"$types")
    addons=$(find ${bundle} -name '*.node')
    [ -z "$native$addons" ] || fail "native code in the bundle:"$'\n'"$native$addons"
    [ -z "$archives" ] || fail "archives in the bundle:"$'\n'"$archives"

    # The server is bundled into a few files, so their source maps list the modules inside them.
    maps=$(find ${bundle}/server -name '*.map')
    [ -n "$maps" ] || fail "server/ has no source map to read its modules from"
    sources=$(jq -r '(.sources // []), (.sections // [] | map(.map.sources) | add // []) | .[]' $maps)
    [ -n "$sources" ] || fail "the source maps in server/ list no modules"
    client=$(matching -E 'node_modules/(@expo|@expo-[^/]+|@react-native|@react-native-[^/]+|expo|expo-[^/]+|react-native|react-native-[^/]+|metro|metro-[^/]+)/' <<<"$sources")
    [ -z "$client" ] || fail "the server contains client modules:"$'\n'"$(head -20 <<<"$client")"

    node ${bareImports} ${bundle}/server/*.mjs

    {
      echo "bundle $((size / 1000)) kB, no references, no native code, no archives"
      echo "server modules $(wc -l <<<"$sources"), all imports bundled or built in"
      for part in server migrations web app; do
        echo "$part $(du -sk --apparent-size ${bundle}/$part | cut -f1) kB"
      done
    } | tee $out
  ''

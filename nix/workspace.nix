{ pkgs, root }:
let
  lib = pkgs.lib;
  nodejs = pkgs.nodejs_24;
  pnpm = pkgs.pnpm_11.override { nodejs-slim = nodejs; };
  sources = import ./workspace-source.nix {
    inherit lib root;
  };

  prepareAction = pkgs.writeShellApplication {
    name = "studienbuch-prepare-action";
    runtimeInputs = [
      pkgs.coreutils
      pkgs.findutils
      pnpm
    ];
    text = ''
      set -euo pipefail

      checkout="$(project-context path checkout)"
      cache_root="$(project-context path cache)"
      preparation_state="$cache_root/preparation"
      stamp_file="$preparation_state/dependencies.sha256"
      cd "$checkout"

      dependency_key=$(
        {
          sha256sum flake.lock package.json pnpm-lock.yaml pnpm-workspace.yaml
          find apps packages -type f -name package.json -print0 \
            | sort -z \
            | xargs -0 -r sha256sum
          if [[ -d patches ]]; then
            find patches -type f -print0 \
              | sort -z \
              | xargs -0 -r sha256sum
          fi
        } | sha256sum | cut -d ' ' -f 1
      )

      if [[ -d node_modules && -f "$stamp_file" ]] \
        && [[ "$(<"$stamp_file")" == "$dependency_key" ]]; then
        echo "Studienbuch dependencies are already prepared ($dependency_key)"
        exit 0
      fi

      pnpm install --frozen-lockfile
      install -d -m 0700 "$preparation_state"
      printf '%s\n' "$dependency_key" > "$stamp_file.next"
      mv "$stamp_file.next" "$stamp_file"
    '';
  };
in
{
  inherit
    nodejs
    pnpm
    prepareAction
    ;
  inherit (sources) dependencySource sourceFor;
}

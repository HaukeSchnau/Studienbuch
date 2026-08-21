{ pkgs, root }:
let
  lib = pkgs.lib;
  nodejs = pkgs.nodejs-slim_24;
  pnpm = pkgs.pnpm_11.override { nodejs-slim = nodejs; };
  workspaceSources = import ./lib/pnpm-workspace-source.nix {
    inherit lib root;
    name = "studienbuch-workspace";
    additionalPackageFiles = lib.optional (builtins.pathExists (
      root + "/tsconfig.json"
    )) "tsconfig.json";
    patchDirectory = "patches";
    ignoredDirectories = [
      ".direnv"
      ".git"
      ".jj"
      ".nitro"
      ".output"
      ".tanstack"
      ".vite-plus"
      "dist"
      "node_modules"
      "storybook-static"
      "tmp"
    ];
    ignoredFileNames = [ "nix.nix" ];
  };

  sourceCheck =
    let
      inherit (workspaceSources) dependencySource;
      webSource = workspaceSources.sourceFor "@stu/web";
      mobileSource = workspaceSources.sourceFor "@stu/mobile";
    in
    pkgs.runCommand "studienbuch-workspace-source-check" { } ''
      test -f ${dependencySource}/apps/web/package.json
      test -f ${dependencySource}/apps/mobile/package.json
      test -f ${dependencySource}/packages/core/package.json
      test -f ${dependencySource}/packages/observability/package.json
      test -f ${dependencySource}/scripts/package.json
      test ! -e ${dependencySource}/apps/web/src

      test -f ${webSource}/apps/web/package.json
      # The Release applies migrations in-process, so the history must reach the web build.
      test -d ${webSource}/packages/server/drizzle
      test ! -e ${webSource}/apps/mobile/src
      test ! -e ${webSource}/packages/core/src
      test -d ${webSource}/packages/observability/src

      test -f ${mobileSource}/apps/mobile/package.json
      test -f ${mobileSource}/packages/core/package.json
      test -d ${mobileSource}/packages/core/src
      test -d ${mobileSource}/packages/observability/src
      test ! -e ${mobileSource}/apps/web/src

      test ! -e ${webSource}/apps/web/node_modules
      test ! -e ${webSource}/apps/web/.output
      test ! -e ${webSource}/apps/web/nix.nix
      touch "$out"
    '';

  prepareAction = pkgs.writeShellApplication {
    name = "studienbuch-prepare-action";
    runtimeInputs = [
      pkgs.coreutils
      pkgs.findutils
      pnpm
    ];
    text = ''
      checkout="$(project-context path checkout)"
      cache_root="$(project-context path cache)"
      preparation_state="$cache_root/preparation"
      stamp_file="$preparation_state/dependencies.sha256"
      cd "$checkout"

      dependency_key=$(
        {
          sha256sum flake.lock ${lib.escapeShellArgs workspaceSources.dependencyInputPaths}
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
  checks.workspaceSource = sourceCheck;
  preparation.action = prepareAction;
  sources = {
    inherit (workspaceSources) dependencySource sourceFor;
  };
  toolchain = { inherit nodejs pnpm; };
}

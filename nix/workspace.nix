{ pkgs, root }:
let
  lib = pkgs.lib;
  inherit (import ./toolchain.nix { inherit pkgs; }) nodejs pnpm;
  workspaceSources = import ./lib/pnpm-workspace-source.nix {
    inherit lib root;
    name = "studienbuch-workspace";
    additionalDependencyFiles = [
      "nix/web-pnpmfile.cjs"
      "pnpm-lock.web.yaml"
    ];
    additionalPackageFiles = lib.optional (builtins.pathExists (
      root + "/tsconfig.json"
    )) "tsconfig.json";
    patchDirectory = "patches";
    ignoredDirectories = [
      ".devenv"
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
      webReleaseSource = workspaceSources.sourceForPackages [
        "@stu/web"
        "@stu/console"
      ];
      mobileSource = workspaceSources.sourceFor "@stu/mobile";
    in
    pkgs.runCommand "studienbuch-workspace-source-check" { } ''
      test -f ${dependencySource}/apps/web/package.json
      test -f ${dependencySource}/pnpm-lock.web.yaml
      test -f ${dependencySource}/nix/web-pnpmfile.cjs
      test -f ${dependencySource}/apps/mobile/package.json
      test -f ${dependencySource}/packages/core/package.json
      test -f ${dependencySource}/packages/observability/package.json
      test -f ${dependencySource}/scripts/package.json
      test ! -e ${dependencySource}/apps/web/src

      test -f ${webSource}/apps/web/package.json
      test -f ${webSource}/pnpm-lock.web.yaml
      test -f ${webSource}/nix/web-pnpmfile.cjs
      # The Release applies migrations in-process, so the history must reach the web build.
      test -d ${webSource}/packages/server/drizzle
      test ! -e ${webSource}/apps/mobile/src
      # @stu/server depends on @stu/core, so the production source must contain the core package.
      test -d ${webSource}/packages/core/src
      test -d ${webSource}/packages/observability/src

      test -f ${webReleaseSource}/apps/web/package.json
      test -f ${webReleaseSource}/apps/console/package.json
      test -d ${webReleaseSource}/apps/console/src
      test -d ${webReleaseSource}/packages/server/src

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

in
{
  checks.workspaceSource = sourceCheck;
  sources = {
    inherit (workspaceSources) dependencySource sourceFor sourceForPackages;
  };
  toolchain = { inherit nodejs pnpm; };
}

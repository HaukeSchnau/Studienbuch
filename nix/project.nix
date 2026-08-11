{
  descriptorPath,
  nix-infra-modules,
  nixpkgs,
  root,
}:
let
  descriptor = builtins.fromJSON (builtins.readFile descriptorPath);

  systems = [
    "aarch64-darwin"
    "aarch64-linux"
    "x86_64-linux"
  ];

  forSystem =
    system:
    let
      pkgs = import nixpkgs {
        inherit system;
        config = {
          allowUnfree = true;
          android_sdk.accept_license = true;
        };
      };
      inherit (pkgs) lib;
      isLinux = pkgs.stdenv.hostPlatform.isLinux;

      workspace = import ./workspace.nix {
        inherit pkgs root;
      };
      mobile = import ../apps/mobile/nix.nix {
        inherit pkgs;
        inherit (workspace) nodejs;
      };
      web = import ../apps/web/nix.nix {
        inherit pkgs root workspace;
      };

      projectRuntime = nix-infra-modules.lib.projectRuntime.mkDevelopment {
        inherit pkgs descriptorPath;
        actions = {
          prepare = workspace.prepareAction;
          web = web.developmentAction;
          mobile = mobile.developmentAction;
        };
      };

      projectRelease =
        if isLinux then
          nix-infra-modules.lib.projectRuntime.mkServiceRelease {
            inherit pkgs descriptorPath;
            payloads = [ web.webApplication ];
            actions.web = web.releaseAction;
          }
        else
          null;
    in
    {
      apps = projectRuntime.apps;

      packages = {
        projectRuntime = projectRuntime.package;
        default = projectRuntime.package;
      }
      // lib.optionalAttrs isLinux {
        projectRelease = projectRelease.package;
        webApplication = web.webApplication;
      };

      checks =
        projectRuntime.checks
        // lib.optionalAttrs isLinux {
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
            cmp ${descriptorPath} ${projectRelease.package}/share/project/descriptor.json
            touch "$out"
          '';
          releaseInterface = projectRelease.checks.interface;
          releasePackage = projectRelease.package;
          releaseSmoke = web.mkReleaseSmoke projectRelease.package;
          webApplication = web.webApplication;
        };

      devShells.default = pkgs.mkShellNoCC (
        mobile.devShellEnvironment
        // {
          packages = [
            workspace.nodejs
            workspace.pnpm
            pkgs.just
          ]
          ++ mobile.devShellPackages;

          shellHook = ''
            export PATH="$PWD/node_modules/.bin:$PATH"
          '';
        }
      );
    };
in
{
  inherit descriptor forSystem systems;
}

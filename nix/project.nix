{
  descriptorPath,
  nix-infra-modules,
  nixpkgs,
  root,
}:
let
  descriptor = nixpkgs.lib.importJSON descriptorPath;

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
        inherit pkgs workspace;
      };

      projectRuntime = nix-infra-modules.lib.projectRuntime.mkDevelopment {
        inherit pkgs descriptorPath;
        actions = {
          prepare = workspace.prepareAction;
          web = web.developmentAction;
          mobile = mobile.developmentAction;
        };
      };
      projectChecks = import ./checks.nix {
        inherit
          descriptorPath
          pkgs
          web
          workspace
          ;
      };
      linuxOutputs =
        if isLinux then
          let
            projectRelease = nix-infra-modules.lib.projectRuntime.mkServiceRelease {
              inherit pkgs descriptorPath;
              payloads = [ web.webApplication ];
              actions.web = web.releaseAction;
            };
          in
          {
            packages = {
              projectRelease = projectRelease.package;
              webApplication = web.webApplication;
            };
            checks = projectChecks.forRelease projectRelease;
          }
        else
          {
            packages = { };
            checks = { };
          };
    in
    {
      apps = projectRuntime.apps;

      packages = {
        projectRuntime = projectRuntime.package;
        default = projectRuntime.package;
      }
      // linuxOutputs.packages;

      checks =
        projectRuntime.checks
        // {
          inherit (projectChecks) workspaceSource;
        }
        // linuxOutputs.checks;

      formatter = pkgs.nixfmt-tree;

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

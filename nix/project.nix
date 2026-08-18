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
        inherit (workspace.toolchain) nodejs;
      };
      web = import ../apps/web/nix.nix {
        inherit pkgs workspace;
      };
      database = import ./database.nix {
        inherit pkgs workspace;
      };

      projectRuntime = nix-infra-modules.lib.projectRuntime.mkDevelopment {
        inherit pkgs descriptorPath;
        actions = {
          prepare = workspace.preparation.action;
          database = database.action;
          migrate = database.migrationAction;
          web = web.development.action;
          mobile = mobile.development.action;
        };
      };
      projectChecks = import ./checks.nix {
        inherit descriptorPath pkgs;
      };
      linuxOutputs =
        if isLinux then
          let
            projectRelease = nix-infra-modules.lib.projectRuntime.mkServiceRelease {
              inherit pkgs descriptorPath;
              payloads = [ web.release.payload ];
              actions.web = web.release.action;
            };
          in
          {
            packages = {
              projectRelease = projectRelease.package;
              webApplication = web.release.payload;
            };
            checks = projectChecks.forRelease {
              inherit projectRelease;
              webApplication = web.release.payload;
            };
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

      checks = projectRuntime.checks // workspace.checks // linuxOutputs.checks;

      formatter = pkgs.nixfmt-tree;

      devShells.default = pkgs.mkShellNoCC (
        mobile.devShell.environment
        // {
          packages = [
            workspace.toolchain.nodejs
            workspace.toolchain.pnpm
            pkgs.just
            pkgs.python3
            pkgs.stdenv.cc
          ]
          ++ mobile.devShell.packages;

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

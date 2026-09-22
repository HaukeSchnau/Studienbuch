{
  descriptor,
  nix-infra-modules,
  nixpkgs,
  root,
}:
let
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
      };
      web = import ../apps/web/nix.nix {
        inherit pkgs workspace;
      };
      # TODO: remove this override once the Mermaid cardinality fix is released by Atlas and
      # available in nixpkgs. The patch matches the upstream contribution linked from the README.
      atlas = pkgs.atlas.overrideAttrs (old: {
        patches = (old.patches or [ ]) ++ [ ./atlas-mermaid-required-cardinality.patch ];
        # The upstream derivation otherwise builds and tests every package in the repository.
        # This shell only consumes the CLI; the patched cmdlog tests run in the upstream change.
        subPackages = [ "." ];
        doCheck = false;
        enableParallelBuilding = true;
      });

      projectChecks = import ./checks.nix { inherit pkgs; };
      developmentPackages = [
        workspace.toolchain.nodejs
        workspace.toolchain.pnpm
        pkgs.just
        pkgs.python3
        pkgs.stdenv.cc
      ];
      ciPackages =
        developmentPackages
        ++ lib.optionals isLinux [
          pkgs.procps
          pkgs.rsync
          pkgs.util-linux
        ];
      diagramPackages = [
        atlas
        pkgs.mermaid-cli
      ];
      developmentShellHook = import ./shell-environment.nix;
      linuxOutputs =
        if isLinux then
          let
            projectRelease = nix-infra-modules.lib.projectRuntime.mkServiceRelease {
              inherit pkgs descriptor;
              payloads = [
                web.release.payload
              ];
              actions = {
                web = web.release.action;
                migrate = web.release.migrationAction;
                console = web.console.releaseAction;
              }
              // web.release.maintenanceActions;
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
      packages = linuxOutputs.packages;

      checks = workspace.checks // linuxOutputs.checks;

      formatter = pkgs.nixfmt-tree;

      devShells = {
        # CI needs the project toolchain, not the Android SDK, NDK, JDKs, Gradle, or Watchman.
        ci = pkgs.mkShellNoCC {
          packages = ciPackages;
          shellHook = developmentShellHook;
        };

        default = pkgs.mkShellNoCC (
          mobile.devShell.environment
          // {
            packages = developmentPackages ++ diagramPackages ++ mobile.devShell.packages;
            shellHook = developmentShellHook;
          }
        );
      };
    };
in
{
  inherit descriptor forSystem systems;
}

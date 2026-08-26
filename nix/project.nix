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
      worker = import ../apps/worker/nix.nix {
        inherit pkgs workspace;
      };
      database = import ./database.nix {
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

      projectRuntime = nix-infra-modules.lib.projectRuntime.mkDevelopment {
        inherit pkgs descriptorPath;
        actions = {
          prepare = workspace.preparation.action;
          database = database.action;
          migrate = database.migrationAction;
          web = web.development.action;
          mobile = mobile.development.action;
          console = web.console.developmentAction;
          worker = worker.development.action;
        };
      };
      projectChecks = import ./checks.nix {
        inherit descriptorPath pkgs;
      };
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
          pkgs.rsync
          pkgs.util-linux
        ];
      diagramPackages = [
        atlas
        pkgs.mermaid-cli
      ];
      developmentShellHook = ''
        export PATH="$PWD/node_modules/.bin:$PATH"

        # Testcontainers talks to a Docker-compatible socket. On rootless Podman hosts that
        # socket is per-user and DOCKER_HOST is not set for us, so point at it here rather than
        # from a wrapper script around the test runner.
        if [ -z "''${DOCKER_HOST:-}" ]; then
          podman_socket="''${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/podman/podman.sock"
          if [ -S "$podman_socket" ]; then
            export DOCKER_HOST="unix://$podman_socket"
            export TESTCONTAINERS_RYUK_DISABLED="''${TESTCONTAINERS_RYUK_DISABLED:-true}"
          fi
          unset podman_socket
        fi
      '';
      linuxOutputs =
        if isLinux then
          let
            projectRelease = nix-infra-modules.lib.projectRuntime.mkServiceRelease {
              inherit pkgs descriptorPath;
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
      apps = projectRuntime.apps;

      packages = {
        projectRuntime = projectRuntime.package;
        default = projectRuntime.package;
      }
      // linuxOutputs.packages;

      checks = projectRuntime.checks // workspace.checks // linuxOutputs.checks;

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

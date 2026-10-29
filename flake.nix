{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      inherit (nixpkgs) lib;
      forEach = systems: f: lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
      linux = [
        "aarch64-linux"
        "x86_64-linux"
      ];
      toolchain = pkgs: import ./nix/toolchain.nix { inherit pkgs; };
      # The release is JavaScript without native code (ADR 0005). It is built once, on x86_64, and
      # every host runs that bundle with its own Node, so each system's checks test that pairing.
      release = import ./nix/bundle.nix { pkgs = nixpkgs.legacyPackages.x86_64-linux; };
    in
    {
      # `node` is what a host runs the bundle with.
      packages = forEach linux (
        pkgs:
        {
          node = (toolchain pkgs).nodejs;
        }
        // lib.optionalAttrs (pkgs.stdenv.hostPlatform.system == "x86_64-linux") release
      );

      checks = forEach linux (pkgs: {
        serverSmoke = import ./nix/server-smoke.nix {
          inherit pkgs;
          inherit (release) bundle;
        };
        closureGuard = import ./nix/closure-guard.nix {
          inherit pkgs;
          inherit (release) bundle;
        };
      });

      devShells = forEach (linux ++ [ "aarch64-darwin" ]) (pkgs: {
        ci = pkgs.mkShellNoCC { packages = builtins.attrValues (toolchain pkgs); };
      });
    };
}

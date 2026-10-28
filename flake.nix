{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      inherit (nixpkgs) lib;
      forEach = systems: f: lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
      # The bundle builds and runs on Linux builders; Macs only need the CI shell.
      linux = [
        "aarch64-linux"
        "x86_64-linux"
      ];
      toolchain = pkgs: import ./nix/toolchain.nix { inherit pkgs; };
      release = forEach linux (pkgs: import ./nix/bundle.nix { inherit pkgs; });
    in
    {
      # `node` is what a host runs the bundle with.
      packages = forEach linux (
        pkgs: release.${pkgs.stdenv.hostPlatform.system} // { node = (toolchain pkgs).nodejs; }
      );

      checks = forEach linux (
        pkgs:
        let
          inherit (release.${pkgs.stdenv.hostPlatform.system}) bundle;
        in
        {
          serverSmoke = import ./nix/server-smoke.nix { inherit pkgs bundle; };
          closureGuard = import ./nix/closure-guard.nix { inherit pkgs bundle; };
        }
      );

      devShells = forEach (linux ++ [ "aarch64-darwin" ]) (pkgs: {
        ci = pkgs.mkShellNoCC { packages = builtins.attrValues (toolchain pkgs); };
      });
    };
}

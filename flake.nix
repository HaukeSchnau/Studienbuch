{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nix-infra-modules = {
      url = "github:HaukeSchnau/nix-infra-modules/a78a097b289c9f1b79162b1e2729a27b51eaa8bc";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      nixpkgs,
      flake-utils,
      nix-infra-modules,
      ...
    }:
    let
      project = import ./nix/project.nix {
        inherit nixpkgs nix-infra-modules;
        descriptor = nix-infra-modules.lib.projectDefinition { modules = [ ./project.nix ]; };
        root = ./.;
      };
    in
    {
      lib.project = project.descriptor;
    }
    // flake-utils.lib.eachSystem project.systems project.forSystem;
}

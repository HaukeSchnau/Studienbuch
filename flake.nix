{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nix-infra-modules = {
      url = "github:HaukeSchnau/nix-infra-modules/c08469c9ed76a0e2223cb6bf1ac624580be6f98c";
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

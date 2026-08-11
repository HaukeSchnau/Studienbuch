{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    nix-infra-modules = {
      url = "github:HaukeSchnau/nix-infra-modules/3d11957d4d1c585578548c9a66a95be4edb4021d";
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
        descriptorPath = ./project.json;
        root = ./.;
      };
    in
    {
      lib.project = project.descriptor;
    }
    // flake-utils.lib.eachSystem project.systems project.forSystem;
}

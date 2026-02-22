{
  pkgs,
  lib,
  installWorkspaceDeps,
}:
let
  artifacts = import ./oci/artifacts.nix {
    inherit pkgs lib installWorkspaceDeps;
  };
in
import ./oci/images-and-archives.nix {
  inherit pkgs lib artifacts;
}

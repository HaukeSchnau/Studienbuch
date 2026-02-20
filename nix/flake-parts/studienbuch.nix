{ ... }:
{
  perSystem =
    {
      pkgs,
      lib,
      ...
    }:
    let
      workspace = import ./studienbuch/workspace-scripts.nix { inherit pkgs lib; };
      ociPackages = import ./studienbuch/oci-packages.nix {
        inherit pkgs lib;
        inherit (workspace) installWorkspaceDeps;
      };
    in
    {
      packages = workspace.packages // ociPackages;
      apps = workspace.apps;
    };
}

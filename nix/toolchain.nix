# Node and pnpm come from projects-sdk's shared toolchain; this adds Studienbuch's own tools. `sdk`
# is the projects-sdk source: the flake's input or devenv's `inputs.projectSdk`.
{ pkgs, sdk }:
import "${sdk}/lib/toolchain.nix" { inherit pkgs; }
// {
  # Dev, CI, previews, beta and prod run the same major version.
  postgresql = pkgs.postgresql_18;
}

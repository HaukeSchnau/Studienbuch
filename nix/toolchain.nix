# Node and pnpm come from nix-infra-modules' shared toolchain; this adds Studienbuch's own tools. `sdk`
# is the nix-infra-modules source: the flake's input or devenv's `inputs.projectSdk`.
{ pkgs, sdk }:
import "${sdk}/lib/toolchain.nix" { inherit pkgs; }
// {
  # Dev, CI, previews, beta and prod run the same major version.
  postgresql = pkgs.postgresql_18;
}

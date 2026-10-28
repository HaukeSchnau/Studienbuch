{ pkgs }:
let
  nodejs = pkgs.nodejs-slim_26;
in
{
  inherit nodejs;
  pnpm = pkgs.pnpm_12.override { nodejs-slim = nodejs; };
  # Dev, CI, previews, beta and prod run the same major version.
  postgresql = pkgs.postgresql_18;
}

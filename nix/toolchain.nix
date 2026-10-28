{ pkgs }:
let
  nodejs = pkgs.nodejs-slim_26;
in
{
  inherit nodejs;
  pnpm = pkgs.pnpm_12.override { nodejs-slim = nodejs; };
}

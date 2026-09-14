{ pkgs }:
let
  nodejs = pkgs.nodejs-slim_24;
in
{
  inherit nodejs;
  pnpm = pkgs.pnpm_11.override { nodejs-slim = nodejs; };
}

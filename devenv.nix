{ pkgs, ... }:
{
  packages = builtins.attrValues (import ./nix/toolchain.nix { inherit pkgs; });

  enterShell = ''
    export PATH="$DEVENV_ROOT/node_modules/.bin:$PATH"
  '';
}

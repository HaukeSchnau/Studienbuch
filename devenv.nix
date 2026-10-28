{ pkgs, config, ... }:
{
  packages = builtins.attrValues (import ./nix/toolchain.nix { inherit pkgs; });

  enterShell = ''
    export PATH="$DEVENV_ROOT/node_modules/.bin:$PATH"
  '';

  # Listens on a socket in this worktree's runtime directory only, so worktrees never share a port.
  services.postgres = {
    enable = true;
    package = pkgs.postgresql_18;
    initialDatabases = [ { name = "studienbuch"; } ];
  };
  env.DATABASE_URL = "postgresql:///studienbuch?host=${config.env.DEVENV_RUNTIME}/postgres";
}

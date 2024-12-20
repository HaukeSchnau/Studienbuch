let
  nixpkgs = fetchTarball "https://github.com/NixOS/nixpkgs/tarball/nixos-24.11";
  pkgs = import nixpkgs { config = {}; overlays = []; };
in

pkgs.mkShellNoCC {
  packages = with pkgs; [
    pnpm
    nodejs_22
  ];

  shellHook = ''
    docker compose -f docker-compose.dev.yaml up -d
  '';
}

{...}: {
  perSystem = {
    pkgs,
    self',
    ...
  }: {
    formatter = pkgs.alejandra;

    devShells.default = pkgs.mkShellNoCC {
      packages = [
        pkgs.alejandra
        pkgs.bun
        pkgs.cloc
        pkgs.cocoapods
        pkgs.deadnix
        pkgs.fd
        pkgs.git
        pkgs.jq
        pkgs.just
        pkgs.maestro
        pkgs.mprocs
        pkgs.nil
        pkgs.nodejs_22
        pkgs.postgresql_17
        pkgs.ripgrep
        pkgs.skopeo
        pkgs.statix
        self'.packages."build-api"
        self'.packages."build-console"
        self'.packages."build-all"
        self'.packages."oci-export-archives"
        self'.packages."oci-load-archives"
        self'.packages.migrations
        self'.packages."start-api"
        self'.packages."start-console"
      ];
    };
  };
}

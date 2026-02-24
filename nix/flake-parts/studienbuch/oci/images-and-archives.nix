{
  pkgs,
  lib,
  artifacts,
}:
let
  inherit (artifacts)
    linuxPkgs
    nodeBin
    runtimeEnv
    runtimeRootfs
    apiRootfs
    consoleRootfs
    migrationsRootfs
    migrationsEntrypoint
    nextjsRootfs
    adminPanelRootfs
    ;

  mkImage =
    {
      name,
      contents,
      config,
      extraContents ? [ ],
      includeNode ? true,
      maxLayers ? 14,
    }:
    linuxPkgs.dockerTools.buildLayeredImage {
      inherit name config maxLayers;
      contents =
        [
          runtimeRootfs
          linuxPkgs.cacert
        ]
        ++ lib.optional includeNode linuxPkgs.nodejs_22
        ++ extraContents
        ++ contents;
      tag = "nix";
      created = "1970-01-01T00:00:01Z";
    };

  images = {
    api = mkImage {
      name = "studienbuch-api";
      contents = [ apiRootfs ];
      config = {
        Env = runtimeEnv ++ [ "PORT=80" "API_PORT=80" ];
        WorkingDir = "/app";
        Entrypoint = [ nodeBin "node.js" ];
      };
    };

    "console-cron" = mkImage {
      name = "studienbuch-console-cron";
      contents = [ consoleRootfs ];
      extraContents = [ linuxPkgs.busybox ];
      config = {
        Env = runtimeEnv;
        WorkingDir = "/app";
        Entrypoint = [
          "${linuxPkgs.busybox}/bin/crond"
          "-f"
          "-l"
          "0"
          "-c"
          "/var/spool/cron/crontabs"
        ];
      };
    };

    migrations = mkImage {
      name = "studienbuch-migrations";
      contents = [
        migrationsRootfs
        migrationsEntrypoint
      ];
      includeNode = false;
      config = {
        Env = runtimeEnv;
        WorkingDir = "/app";
        Entrypoint = [ "/bin/migrate" ];
      };
    };

    nextjs = mkImage {
      name = "studienbuch-nextjs";
      contents = [ nextjsRootfs ];
      config = {
        Env = runtimeEnv ++ [ "PORT=80" ];
        WorkingDir = "/app/packages/web";
        Entrypoint = [ nodeBin ".output/server/index.mjs" ];
      };
    };

    "admin-panel" = mkImage {
      name = "studienbuch-admin-panel";
      contents = [ adminPanelRootfs ];
      config = {
        Env = runtimeEnv ++ [ "PORT=80" ];
        WorkingDir = "/app/packages/admin-panel";
        Entrypoint = [ nodeBin ".output/server/index.mjs" ];
      };
    };
  };

  mkOciArchive =
    {
      image,
      imageName,
      archiveName,
    }:
    pkgs.runCommand archiveName
      {
        nativeBuildInputs = [ pkgs.skopeo ];
      }
      ''
        skopeo --insecure-policy copy \
          "docker-archive:${image}" \
          "oci-archive:$out:${imageName}:nix"
      '';

  archives = lib.mapAttrs (
    name: image:
    mkOciArchive {
      inherit image;
      imageName = "studienbuch-${name}";
      archiveName = "studienbuch-${name}-nix.oci.tar";
    }
  ) images;

  imagePackages = lib.mapAttrs' (name: image: lib.nameValuePair "image-${name}" image) images;
  archivePackages = lib.mapAttrs' (name: archive: lib.nameValuePair "oci-${name}-archive" archive) archives;

  archiveCopyLines = lib.concatStringsSep "\n" (
    lib.mapAttrsToList (
      name: archive: ''cp ${archive} "$out/studienbuch-${name}-nix.oci.tar"''
    ) archives
  );

  ociArchives = pkgs.runCommand "studienbuch-oci-archives" { } ''
    mkdir -p "$out"
    ${archiveCopyLines}
  '';
in
imagePackages
// archivePackages
// {
  "oci-archives" = ociArchives;
}

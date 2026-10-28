# The release: one architecture-independent JS bundle (ADR 0005, hosting.md section 2). `deps`
# installs the workspace once per lockfile, each build filters its source to its own package and the
# workspace packages it depends on, and `bundle` only puts the three outputs side by side.
{ pkgs }:
let
  inherit (pkgs) lib stdenvNoCC;
  inherit (import ./toolchain.nix { inherit pkgs; }) nodejs pnpm;
  fs = lib.fileset;
  root = ../.;

  # The packages that pnpm-workspace.yaml's `apps/*` and `packages/*` match.
  packageDirs =
    lib.concatMap
      (
        parent:
        lib.pipe (builtins.readDir (root + "/${parent}")) [
          (lib.filterAttrs (
            name: type: type == "directory" && builtins.pathExists (root + "/${parent}/${name}/package.json")
          ))
          lib.attrNames
          (map (name: "${parent}/${name}"))
        ]
      )
      [
        "apps"
        "packages"
      ];

  manifest = dir: lib.importJSON (root + "/${dir}/package.json");
  dirOfPackage = lib.listToAttrs (map (dir: lib.nameValuePair (manifest dir).name dir) packageDirs);

  # A package's directory and those of the workspace packages it depends on, transitively.
  withWorkspaceDeps =
    dir:
    let
      direct =
        dir:
        let
          package = manifest dir;
        in
        lib.mapAttrsToList (name: _: dirOfPackage.${name}) (
          lib.filterAttrs (_: lib.hasPrefix "workspace:") (
            package.dependencies or { } // package.devDependencies or { }
          )
        );
      grow =
        dirs:
        let
          next = lib.unique (dirs ++ lib.concatMap direct dirs);
        in
        if next == dirs then dirs else grow next;
    in
    grow [ dir ];

  # Tests never reach a build, so changing one rebuilds nothing.
  isTest =
    file:
    lib.any (suffix: lib.hasSuffix suffix file.name) [
      ".test.ts"
      ".test.tsx"
      ".bench.ts"
    ];

  sourceFor =
    dir:
    fs.toSource {
      inherit root;
      fileset = fs.unions (
        [
          (root + "/package.json")
          (root + "/pnpm-workspace.yaml")
          (root + "/tsconfig.base.json")
        ]
        ++ map (dir: fs.fileFilter (file: !isTest file) (root + "/${dir}")) (withWorkspaceDeps dir)
      );
    };

  depsSource = fs.toSource {
    inherit root;
    fileset = fs.unions (
      [
        (root + "/package.json")
        (root + "/pnpm-lock.yaml")
        (root + "/pnpm-workspace.yaml")
      ]
      ++ map (dir: root + "/${dir}/package.json") packageDirs
    );
  };

  pnpmDeps = pkgs.fetchPnpmDeps {
    pname = "studienbuch";
    version = "0";
    src = depsSource;
    inherit pnpm;
    fetcherVersion = 5;
    # A changed pnpm-lock.yaml fails this fetch with a hash mismatch. Replace the hash with the one
    # after `got:`.
    hash = "sha256-AxVdRHKGs6meoLZhXSbz9t5ZYplF4vgYoaIbq4zECtw=";
  };

  # Every workspace package's node_modules, installed offline from `pnpmDeps`.
  deps = stdenvNoCC.mkDerivation {
    name = "studienbuch-deps";
    src = depsSource;
    inherit pnpmDeps;
    nativeBuildInputs = [
      nodejs
      pnpm
      pkgs.pnpmConfigHook
    ];
    dontBuild = true;
    dontFixup = true;
    installPhase = ''
      for dir in . ${toString packageDirs}; do
        if [ -d "$dir/node_modules" ]; then
          mkdir -p "$out/$dir"
          mv "$dir/node_modules" "$out/$dir/"
        fi
      done
    '';
    passthru = { inherit pnpmDeps; };
  };

  # Runs a package's own build script with the installed workspace beside its sources.
  build =
    {
      name,
      dir,
      script,
      install,
      env ? { },
    }:
    stdenvNoCC.mkDerivation {
      inherit name env;
      src = sourceFor dir;
      nativeBuildInputs = [
        nodejs
        pnpm
      ];
      # Fixup would point shebangs at this system's Node, and the bundle must reference nothing.
      dontFixup = true;
      configurePhase = ''
        runHook preConfigure
        for dir in . ${toString (withWorkspaceDeps dir)}; do
          if [ -d "${deps}/$dir/node_modules" ]; then
            cp -a --reflink=auto "${deps}/$dir/node_modules" "$dir/"
            # Tools keep caches there, such as Vite's `.vite`.
            chmod u+w "$dir/node_modules"
          fi
        done
        # The source holds only this package's part of the workspace, which pnpm would take for an
        # outdated install.
        export HOME=$TMPDIR pnpm_config_pm_on_fail=ignore pnpm_config_verify_deps_before_run=false
        runHook postConfigure
      '';
      buildPhase = ''
        runHook preBuild
        cd ${dir}
        pnpm run ${script}
        runHook postBuild
      '';
      installPhase = ''
        runHook preInstall
        ${install}
        runHook postInstall
      '';
    };

  serverBuild = build {
    name = "studienbuch-server";
    dir = "apps/server";
    script = "build";
    install = ''
      mkdir -p $out/server
      cp -r dist/. $out/server/
      cp -r migrations $out/migrations
    '';
  };

  webBuild = build {
    name = "studienbuch-web";
    dir = "apps/web";
    script = "build";
    install = "cp -r dist/client $out";
  };

  appWebBuild = build {
    name = "studienbuch-app-web";
    dir = "apps/app";
    script = "build:web";
    env = {
      CI = "1";
      EXPO_NO_TELEMETRY = "1";
      EXPO_OFFLINE = "1";
    };
    install = "cp -r dist $out";
  };

  # What a host runs with its own Node 26: `node server/main.mjs`, with `migrations/`, `web/` and
  # `app/` beside `server/`, where main.ts looks for them.
  bundle = pkgs.runCommand "studienbuch-bundle" { } ''
    mkdir $out
    cp -r ${serverBuild}/. $out/
    cp -r ${webBuild} $out/web
    cp -r ${appWebBuild} $out/app
  '';
in
{
  inherit
    deps
    serverBuild
    webBuild
    appWebBuild
    bundle
    ;
}

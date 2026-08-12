{ lib, root }:
let
  unquote =
    value:
    let
      doubleQuoted = builtins.match ''"(.*)"'' value;
      singleQuoted = builtins.match "'(.*)'" value;
    in
    if doubleQuoted != null then
      builtins.head doubleQuoted
    else if singleQuoted != null then
      builtins.head singleQuoted
    else
      value;
  workspacePatternState =
    lib.foldl'
      (
        state: line:
        let
          item = if state.inPackages then builtins.match "  - (.+)" line else null;
        in
        if line == "packages:" then
          state // { inPackages = true; }
        else if item != null then
          state // { patterns = state.patterns ++ [ (unquote (builtins.head item)) ]; }
        else if state.inPackages && builtins.match "[^ ].*" line != null then
          state // { inPackages = false; }
        else
          state
      )
      {
        inPackages = false;
        patterns = [ ];
      }
      (lib.splitString "\n" (builtins.readFile (root + "/pnpm-workspace.yaml")));
  workspacePatterns =
    if workspacePatternState.patterns == [ ] then
      throw "workspace source: pnpm-workspace.yaml does not declare packages"
    else
      workspacePatternState.patterns;

  pathFor = relative: root + "/${relative}";
  expandWorkspacePattern =
    pattern:
    let
      wildcard = builtins.match "(.+)/\\*" pattern;
    in
    if wildcard == null then
      if builtins.pathExists (pathFor "${pattern}/package.json") then
        [ pattern ]
      else
        throw "workspace source: ${pattern} does not contain package.json"
    else
      let
        directory = builtins.elemAt wildcard 0;
        entries = builtins.readDir (pathFor directory);
      in
      map (entry: "${directory}/${entry}") (
        lib.filter (
          entry:
          lib.elem entries.${entry} [
            "directory"
            "symlink"
          ]
          && builtins.pathExists (pathFor "${directory}/${entry}/package.json")
        ) (builtins.attrNames entries)
      );

  workspacePaths = lib.concatMap expandWorkspacePattern workspacePatterns;
  workspacePackages = map (
    relativePath:
    let
      manifest = builtins.fromJSON (builtins.readFile (pathFor "${relativePath}/package.json"));
    in
    if manifest ? name then
      {
        inherit manifest relativePath;
        name = manifest.name;
      }
    else
      throw "workspace source: ${relativePath}/package.json has no package name"
  ) workspacePaths;
  packageNames = map (package: package.name) workspacePackages;
  packagesByName = builtins.listToAttrs (
    map (package: {
      inherit (package) name;
      value = package;
    }) workspacePackages
  );

  dependencyFields = [
    "dependencies"
    "devDependencies"
    "optionalDependencies"
    "peerDependencies"
  ];
  localDependencies =
    manifest:
    lib.filter (name: builtins.hasAttr name packagesByName) (
      lib.unique (lib.concatMap (field: builtins.attrNames (manifest.${field} or { })) dependencyFields)
    );
  packageClosure =
    rootPackage:
    let
      visit =
        visited: pending:
        if pending == [ ] then
          visited
        else
          let
            packageName = builtins.head pending;
            remaining = builtins.tail pending;
          in
          if lib.elem packageName visited then
            visit visited remaining
          else
            visit (visited ++ [ packageName ]) (
              remaining ++ localDependencies packagesByName.${packageName}.manifest
            );
    in
    if builtins.hasAttr rootPackage packagesByName then
      visit [ ] [ rootPackage ]
    else
      throw "workspace source: unknown package ${rootPackage}; expected one of ${lib.concatStringsSep ", " packageNames}";

  rootFiles = [
    "package.json"
    "pnpm-lock.yaml"
    "pnpm-workspace.yaml"
  ];
  workspaceManifestFiles = map (relativePath: "${relativePath}/package.json") workspacePaths;
  ignoredDirectories = [
    ".direnv"
    ".git"
    ".jj"
    ".nitro"
    ".output"
    ".tanstack"
    ".vite-plus"
    "dist"
    "node_modules"
    "storybook-static"
    "tmp"
  ];
  isWithin = relative: directory: relative == directory || lib.hasPrefix "${directory}/" relative;
  isAncestor = relative: target: relative == "" || lib.hasPrefix "${relative}/" target;
  isIgnored =
    relative: type:
    (type == "directory" && lib.elem (baseNameOf relative) ignoredDirectories)
    || lib.hasSuffix "/nix.nix" relative;

  mkSource =
    {
      name,
      packageRoots ? [ ],
      extraRootFiles ? [ ],
    }:
    let
      includedFiles = rootFiles ++ workspaceManifestFiles ++ extraRootFiles;
      includedDirectories =
        packageRoots ++ lib.optional (builtins.pathExists (root + "/patches")) "patches";
      relevantDirectory =
        relative:
        lib.any (target: isWithin relative target || isAncestor relative target) (
          includedDirectories ++ includedFiles
        );
    in
    lib.cleanSourceWith {
      inherit name;
      src = root;
      filter =
        path: type:
        let
          relative = lib.removePrefix ((toString root) + "/") (toString path);
        in
        !isIgnored relative type
        && (
          if type == "directory" then
            relevantDirectory relative
          else
            lib.elem relative includedFiles
            || lib.any (directory: isWithin relative directory) includedDirectories
        );
    };
in
assert
  lib.length packageNames == lib.length (lib.unique packageNames)
  || throw "workspace source: workspace package names must be unique";
{
  dependencySource = mkSource {
    name = "studienbuch-workspace-dependencies";
  };

  sourceFor =
    packageName:
    let
      closure = packageClosure packageName;
      sourceName = lib.replaceStrings [ "@" "/" ] [ "" "-" ] packageName;
    in
    mkSource {
      name = "studienbuch-${sourceName}-source";
      packageRoots = map (name: packagesByName.${name}.relativePath) closure;
      extraRootFiles = lib.optional (builtins.pathExists (root + "/tsconfig.json")) "tsconfig.json";
    };
}

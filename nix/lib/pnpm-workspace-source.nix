{
  lib,
  root,
  name ? "pnpm-workspace",
  additionalPackageFiles ? [ ],
  patchDirectory ? null,
  ignoredDirectories ? [
    ".git"
    "node_modules"
  ],
  ignoredFileNames ? [ ],
}:
let
  pathFor = relative: root + "/${relative}";

  readWorkspacePatterns =
    manifestPath:
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

      step =
        state: line:
        let
          packageItem = if state.inPackages then builtins.match "  - (.+)" line else null;
        in
        if line == "packages:" then
          state // { inPackages = true; }
        else if packageItem != null then
          state // { patterns = [ (unquote (builtins.head packageItem)) ] ++ state.patterns; }
        else if state.inPackages && builtins.match "[^ ].*" line != null then
          state // { inPackages = false; }
        else
          state;

      result = lib.foldl' step {
        inPackages = false;
        patterns = [ ];
      } (lib.splitString "\n" (builtins.readFile manifestPath));
    in
    if result.patterns == [ ] then
      throw "pnpm workspace source: pnpm-workspace.yaml does not declare packages"
    else
      lib.reverseList result.patterns;

  workspacePatterns = readWorkspacePatterns (pathFor "pnpm-workspace.yaml");

  validatePackagePath =
    relativePath:
    if builtins.pathExists (pathFor "${relativePath}/package.json") then
      [ relativePath ]
    else
      throw "pnpm workspace source: ${relativePath} does not contain package.json";

  expandPackageDirectory =
    parentPath:
    let
      entries = builtins.readDir (pathFor parentPath);
      isPackageDirectory =
        childName:
        lib.elem entries.${childName} [
          "directory"
          "symlink"
        ]
        && builtins.pathExists (pathFor "${parentPath}/${childName}/package.json");
    in
    map (childName: "${parentPath}/${childName}") (
      lib.filter isPackageDirectory (builtins.attrNames entries)
    );

  expandWorkspacePattern =
    pattern:
    let
      wildcardMatch = builtins.match "(.+)/\\*" pattern;
    in
    if wildcardMatch == null then
      if lib.hasInfix "*" pattern then
        throw "pnpm workspace source: unsupported workspace pattern ${pattern}; expected a package path or parent/*"
      else
        validatePackagePath pattern
    else
      expandPackageDirectory (builtins.head wildcardMatch);

  workspacePaths = lib.concatMap expandWorkspacePattern workspacePatterns;
  workspacePackages = map (
    relativePath:
    let
      manifest = lib.importJSON (pathFor "${relativePath}/package.json");
    in
    if manifest ? name then
      {
        inherit manifest relativePath;
        name = manifest.name;
      }
    else
      throw "pnpm workspace source: ${relativePath}/package.json has no package name"
  ) workspacePaths;
  packageNames = map (package: package.name) workspacePackages;
  packagesByName = lib.genAttrs' workspacePackages (package: lib.nameValuePair package.name package);

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
    if builtins.hasAttr rootPackage packagesByName then
      map (package: package.key) (
        builtins.genericClosure {
          startSet = [ { key = rootPackage; } ];
          operator =
            package:
            map (dependency: { key = dependency; }) (localDependencies packagesByName.${package.key}.manifest);
        }
      )
    else
      throw "pnpm workspace source: unknown package ${rootPackage}; expected one of ${lib.concatStringsSep ", " packageNames}";

  rootFiles = [
    "package.json"
    "pnpm-lock.yaml"
    "pnpm-workspace.yaml"
  ];
  workspaceManifestFiles = map (relativePath: "${relativePath}/package.json") workspacePaths;
  dependencyInputPaths = rootFiles ++ workspaceManifestFiles;
  isWithin = directory: path: path == directory || lib.hasPrefix "${directory}/" path;
  pathsOverlap = first: second: isWithin first second || isWithin second first;
  isIgnored =
    relative: type:
    (type == "directory" && lib.elem (baseNameOf relative) ignoredDirectories)
    || lib.elem (baseNameOf relative) ignoredFileNames;

  mkSource =
    {
      name,
      packageDirectories ? [ ],
      additionalRootFiles ? [ ],
    }:
    let
      includedFiles = dependencyInputPaths ++ additionalRootFiles;
      includedFileSet = lib.genAttrs includedFiles (_: true);
      selectedDirectories =
        packageDirectories
        ++ lib.optional (
          patchDirectory != null && builtins.pathExists (root + "/${patchDirectory}")
        ) patchDirectory;
      shouldIncludeDirectory =
        relative: lib.any (pathsOverlap relative) (selectedDirectories ++ includedFiles);
      shouldIncludeFile =
        relative:
        builtins.hasAttr relative includedFileSet
        || lib.any (directory: isWithin directory relative) selectedDirectories;
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
        && (if type == "directory" then shouldIncludeDirectory relative else shouldIncludeFile relative);
    };
in
assert
  lib.allUnique packageNames || throw "pnpm workspace source: workspace package names must be unique";
{
  inherit dependencyInputPaths;

  dependencySource = mkSource {
    name = "${name}-dependencies";
  };

  sourceFor =
    packageName:
    let
      closure = packageClosure packageName;
      sourceName = lib.replaceStrings [ "@" "/" ] [ "" "-" ] packageName;
    in
    mkSource {
      name = "${name}-${sourceName}-source";
      packageDirectories = map (packageName: packagesByName.${packageName}.relativePath) closure;
      additionalRootFiles = additionalPackageFiles;
    };
}

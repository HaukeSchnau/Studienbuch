module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name !== "@better-auth/expo") return pkg;

      // TODO: Remove this production-only metadata correction when @better-auth/expo publishes
      // its server plugin without optional native Expo peers on the package root.
      for (const peer of ["expo-constants", "expo-linking", "expo-network", "expo-web-browser"]) {
        delete pkg.peerDependencies?.[peer];
        delete pkg.peerDependenciesMeta?.[peer];
      }
      return pkg;
    },
  },
};

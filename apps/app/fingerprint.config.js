// Expo's fingerprint of the native app is the runtime version an update must match, and it tells CI
// whether a commit needs new store builds. Build numbers stay out, since every store build stamps its
// own (app.config.ts). The version stays in, so a new version is a new binary.
const { version } = require("./package.json");

/** @type {import("expo/fingerprint").Config} */
module.exports = {
  sourceSkips: ["ExpoConfigVersions", "PackageJsonAndroidAndIosScriptsIfNotContainRun"],
  extraSources: [{ type: "contents", id: "version", contents: version, reasons: ["version"] }],
};

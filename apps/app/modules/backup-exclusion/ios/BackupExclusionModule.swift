import ExpoModulesCore

// iOS backs up an app's Documents directory, where expo-sqlite keeps its databases. A phone restored
// from that backup next to the old one would share its sync client id, and the database key stays
// behind (THIS_DEVICE_ONLY), so the copy couldn't be opened anyway (src/infra/backup).
public class BackupExclusionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BackupExclusion")

    // Creates the directory if needed, excludes it and everything in it from backups, and returns
    // whether iOS now reports it excluded.
    Function("exclude") { (path: String) throws -> Bool in
      var url = URL(fileURLWithPath: path, isDirectory: true)
      try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)

      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)

      url.removeAllCachedResourceValues()
      return try url.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup ?? false
    }
  }
}

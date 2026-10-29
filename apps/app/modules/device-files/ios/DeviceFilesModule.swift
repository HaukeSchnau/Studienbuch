import ExpoModulesCore

// What Studienbuch needs from iOS's file system (src/infra/device/DeviceFiles.ts).
public class DeviceFilesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DeviceFiles")

    // iOS backs up Documents, where expo-sqlite keeps its databases. A phone restored from that
    // backup next to the old one would share its sync client id, and the database key stays
    // behind (THIS_DEVICE_ONLY), so the copy couldn't be opened anyway. Creates the directory if
    // needed, excludes it and everything in it, and returns whether iOS now reports it excluded.
    Function("excludeFromBackup") { (path: String) throws -> Bool in
      var url = URL(fileURLWithPath: path, isDirectory: true)
      try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)

      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)

      url.removeAllCachedResourceValues()
      return try url.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup ?? false
    }

    // Deleting the app empties Documents but keeps its keychain entries. A marker file tells the
    // first start of a new install, which then removes what the old install left in the keychain.
    Function("firstStartSinceInstall") { () throws -> Bool in
      let documents = try FileManager.default.url(
        for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      let marker = documents.appendingPathComponent(".studienbuch-installed")

      if FileManager.default.fileExists(atPath: marker.path) { return false }

      try Data().write(to: marker)
      return true
    }
  }
}

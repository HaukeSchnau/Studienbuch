import ExpoModulesCore
import Security

// What Studienbuch needs from iOS's file system and keychain (src/infra/device/files.ts).
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

    // Deleting the app empties Documents but keeps its keychain entries. Without a marker file in
    // Documents, this is the first start of an install: it deletes every entry of the given
    // services, one call each, then writes the marker, so a start cut short tries again. Returns
    // how many entries it deleted, and 0 on every later start.
    Function("clearKeychainAfterInstall") { (services: [String]) throws -> Int in
      let documents = try FileManager.default.url(
        for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      let marker = documents.appendingPathComponent(".studienbuch-installed")

      if FileManager.default.fileExists(atPath: marker.path) { return 0 }

      var deleted = 0

      for service in services {
        let entries: [String: Any] = [
          kSecClass as String: kSecClassGenericPassword,
          kSecAttrService as String: service,
        ]

        var count = entries
        count[kSecMatchLimit as String] = kSecMatchLimitAll
        count[kSecReturnAttributes as String] = true

        var found: CFTypeRef?
        if SecItemCopyMatching(count as CFDictionary, &found) == errSecSuccess,
          let items = found as? [Any]
        {
          deleted += items.count
        }

        let status = SecItemDelete(entries as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
          throw Exception(
            name: "KeychainClearFailed",
            description: "Deleting the keychain entries of \(service) failed with status \(status)")
        }
      }

      try Data().write(to: marker)
      return deleted
    }
  }
}

/// <reference types="node" />
import {
  AndroidConfig,
  type ConfigPlugin,
  withAndroidManifest,
  withDangerousMod,
} from "expo/config-plugins";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

// Android's Auto Backup and device-to-device transfer leave out expo-sqlite's databases (files/SQLite)
// and expo-secure-store's entries, whose Keystore key never leaves the phone. A phone restored next
// to the old one is then a new device: no shared sync client id, no database it can't open. The
// iOS half is the native module beside this file.

const excluded = `<exclude domain="file" path="SQLite"/>
    <exclude domain="sharedpref" path="SecureStore"/>`;

/** Android 11 and lower. */
export const backupRules = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
    ${excluded}
</full-backup-content>
`;

/** Android 12 and higher. */
export const dataExtractionRules = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    ${excluded}
  </cloud-backup>
  <device-transfer>
    ${excluded}
  </device-transfer>
</data-extraction-rules>
`;

export const resources = {
  studienbuch_backup_rules: backupRules,
  studienbuch_data_extraction_rules: dataExtractionRules,
};

/** Points the application at the rules above. */
export const setBackupRules = (manifest: AndroidConfig.Manifest.AndroidManifest) => {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

  application.$["android:fullBackupContent"] = "@xml/studienbuch_backup_rules";
  application.$["android:dataExtractionRules"] = "@xml/studienbuch_data_extraction_rules";

  return manifest;
};

export const withBackupExclusion: ConfigPlugin = (config) =>
  withDangerousMod(
    withAndroidManifest(config, (manifest) => {
      manifest.modResults = setBackupRules(manifest.modResults);

      return manifest;
    }),
    [
      "android",
      (project) => {
        const directory = NodePath.join(
          project.modRequest.platformProjectRoot,
          "app/src/main/res/xml",
        );

        NodeFS.mkdirSync(directory, { recursive: true });

        for (const [name, rules] of Object.entries(resources)) {
          NodeFS.writeFileSync(NodePath.join(directory, `${name}.xml`), rules);
        }

        return Promise.resolve(project);
      },
    ],
  );

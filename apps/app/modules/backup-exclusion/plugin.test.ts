import { assert, it } from "@effect/vitest";
import { AndroidConfig } from "expo/config-plugins";

import { resources, setBackupRules } from "./plugin.ts";

const sections = (xml: string) =>
  ["full-backup-content", "cloud-backup", "device-transfer"].flatMap((tag) => {
    const section = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "u").exec(xml)?.[1];

    return section === undefined ? [] : [section];
  });

// A restored phone must not bring back the databases, or two phones would share a sync client id.
it("both of Android's backup rules leave out the databases and the secure store", () => {
  const manifest = setBackupRules({
    manifest: {
      $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
      queries: [],
      application: [{ $: { "android:name": ".MainApplication" } }],
    },
  });

  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

  const rules = ["android:fullBackupContent", "android:dataExtractionRules"].map((attribute) => {
    const name = application.$[attribute]?.replace(/^@xml\//u, "") ?? "";

    return Object.entries(resources).find(([resource]) => resource === name)?.[1] ?? "";
  });

  const found = rules.flatMap(sections);

  assert.strictEqual(found.length, 3);

  for (const section of found) {
    assert.include(section, '<exclude domain="file" path="SQLite"/>');
    assert.include(section, '<exclude domain="sharedpref" path="SecureStore"/>');
  }
});

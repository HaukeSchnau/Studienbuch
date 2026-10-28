# SQLite on every device

Status: accepted 2026-10-28 ([D29](https://files.schnau.dev/html/studienbuch-roadmap/#D29))

Every device keeps its data in SQLite, and the sync engine sees one Effect `SqlClient`. On iOS and Android that is expo-sqlite with SQLCipher behind our own adapter, keyed from the keychain. On the web it is Effect's `@effect/sql-sqlite-wasm` with our own worker, one OPFS directory per device.

expo-sqlite's web build keeps one storage pool per origin, so a second tab fails even for another database, and virtual devices can't run side by side. Effect's client with one directory per device runs several devices in one browser and measured 2.5 times faster per statement. The price is two drivers in the test matrix, and engine SQL stays within SQLite 3.50, the oldest of the builds.

Reasoning: [client-platform.md, SQLite](https://files.schnau.dev/html/studienbuch-roadmap/doc.html?f=design/client-platform.md#recommendation-for-sqlite).

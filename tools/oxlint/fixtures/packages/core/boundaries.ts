// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: React in core
export { Fragment } from "react";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: React Native in core
export { Platform } from "react-native";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: Expo in core
export { openDatabaseSync } from "expo-sqlite";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: Node in core
export { readFileSync } from "node:fs";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the sync client in core
export { Outbox } from "@stu/sync/client";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the sync server in core
export { Push } from "@stu/sync/server";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a SQL client in core
export { SqlClient } from "effect/sql/SqlClient";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the Clock module in core
export { currentTimeMillis } from "effect/Clock";

// The sync definition API is core's to use.
export { Sync } from "@stu/sync";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: Clock from the barrel in core
export { Clock } from "effect";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: e2ee in core
export { CryptoSuite } from "@stu/e2ee";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the RPC schemas in core
export { System } from "@stu/api/System";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the Sync Lab in core
export { Faults } from "@stu/sync/lab";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the conformance suite in core
export { Replay } from "@stu/sync/conformance";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: Effect's Crypto in core
export { randomBytes } from "effect/Crypto";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: Crypto from the barrel in core
export { Crypto } from "effect";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: Temporal's clock in core
export { instant } from "temporal-polyfill/fns/Now";

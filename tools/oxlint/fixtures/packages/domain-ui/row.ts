// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a dumb component reads SQLite
export { openDatabaseSync } from "expo-sqlite";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a dumb component reads the sync engine
export { Sync } from "@stu/sync";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a dumb component opens sealed rows
export { CryptoSuite } from "@stu/e2ee";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a dumb component calls the server
export { System } from "@stu/api/System";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a dumb component builds an RPC client
export { RpcClient } from "effect/rpc";

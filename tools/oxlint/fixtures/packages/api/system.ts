// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a handler module in api
export { layerProtocolHttp } from "effect/rpc/RpcServer";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: RpcServer from the rpc barrel in api
export { RpcServer } from "effect/rpc";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a SQL client in api
export { SqlClient } from "effect/sql/SqlClient";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: sync in api
export { Sync } from "@stu/sync";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: Node in api
export { readFileSync } from "node:fs";

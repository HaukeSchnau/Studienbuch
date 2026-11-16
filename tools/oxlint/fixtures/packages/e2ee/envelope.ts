// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: e2ee stores nothing
export { getItemAsync } from "expo-secure-store";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: e2ee opens no connection
export { RpcClient } from "effect/rpc";

// oxlint-disable-next-line eslint/no-restricted-globals, effecttsgo/global-fetch -- fixture: e2ee opens no connection
export const send = () => fetch("/api/keys");

// oxlint-disable-next-line eslint/no-restricted-globals, studienbuch/no-global-process-runtime -- fixture: e2ee stores nothing
export const stored = () => localStorage.getItem("key");

// oxlint-disable-next-line eslint/no-restricted-globals -- fixture: the Temporal ban holds in e2ee too
export const sealedAt = () => Temporal.Now.instant();

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a key-value store in e2ee
export { layerMemory } from "effect/persistence/KeyValueStore";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: an HTTP API client in e2ee
export { HttpApiClient } from "effect/http-api";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: atoms in e2ee, which persist and call RPCs
export { Atom } from "effect/reactivity";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a worker in e2ee
export { Worker } from "effect/workers";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the cluster in e2ee
export { Sharding } from "effect/cluster";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the event log in e2ee
export { EventJournal } from "effect/eventlog";

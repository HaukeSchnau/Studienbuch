// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: e2ee stores nothing
export { getItemAsync } from "expo-secure-store";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: e2ee opens no connection
export { RpcClient } from "effect/rpc";

// oxlint-disable-next-line eslint/no-restricted-globals, effecttsgo/global-fetch -- fixture: e2ee opens no connection
export const send = () => fetch("/api/keys");

// oxlint-disable-next-line eslint/no-restricted-globals -- fixture: e2ee stores nothing
export const stored = () => localStorage.getItem("key");

// oxlint-disable-next-line eslint/no-restricted-globals -- fixture: the Temporal ban holds in e2ee too
export const sealedAt = () => Temporal.Now.instant();

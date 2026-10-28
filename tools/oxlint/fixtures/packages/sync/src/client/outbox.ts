// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the client reaches into the server
export { push } from "../server/push.ts";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the client imports the server entry
export { Push } from "@stu/sync/server";

export const outbox = "outbox";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the web app imports sync
export { Sync } from "@stu/sync";

export const console = "console";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: a relative path from an app into a package
export { outbox } from "../../../../packages/sync/src/client/outbox.ts";

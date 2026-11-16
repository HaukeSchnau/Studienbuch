// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the server imports the client entry
export { Outbox } from "@stu/sync/client";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the server engine runs on its host's SqlClient
export { PgClient } from "@effect/sql-pg";

export const push = "push";

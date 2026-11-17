import { pgTable, text } from "drizzle-orm/pg-core";

export * as DeletionTables from "./DeletionTables.ts";

/**
 * One session of a deleted account, so its device learns why the session ended whenever it comes
 * back, and wipes itself. A row names no account and no time: only the SHA-256 of the session's
 * token, which only that device holds.
 */
export const deletedSession = pgTable("deleted_session", {
  /** Hex SHA-256 of `auth_session.token`, the part of the bearer token before its signature. */
  tokenHash: text("token_hash").primaryKey(),
});

/**
 * What the server engine needs from `apps/server`. Besides this it takes Effect's `SqlClient` on
 * PostgreSQL 18 and `CryptoSuite` from `@stu/e2ee`, for the signatures it checks.
 */
import type { AccountKey } from "@stu/e2ee";
import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";
import type * as Headers from "effect/http/Headers";
import type * as Option from "effect/Option";
import type * as SqlError from "effect/sql/SqlError";
import type * as Stream from "effect/Stream";

export * as Ports from "./Ports.ts";

export interface ResolvedSession {
  readonly accountId: string;
  readonly sessionId: string;
  readonly expiresAt: DateTime.Utc;
}

/**
 * Better Auth's sessions, as the ticket route and every connection see them. A connection lives
 * as long as its session: the server closes it with `CloseCode.sessionEnded` once the session is
 * revoked or has ended.
 */
export class SessionResolver extends Context.Service<
  SessionResolver,
  {
    /** The session behind a request's bearer token, or `None` without a valid one. */
    readonly resolve: (headers: Headers.Headers) => Effect.Effect<Option.Option<ResolvedSession>>;
    /** The ids of sessions as they are revoked, such as at sign-out on another device. */
    readonly revoked: Stream.Stream<string>;
  }
>()("@stu/sync/server/SessionResolver") {}

/**
 * The account key records `apps/server` keeps, which a `Seal` checks its key boxes' and history
 * links' signatures against.
 */
export class AccountKeys extends Context.Service<
  AccountKeys,
  {
    /**
     * The account's newest key record, or `None` before a device published one. Read inside the
     * `Seal`'s transaction, it holds the record until commit, so a renewal waits for the check.
     */
    readonly newest: (
      accountId: string,
    ) => Effect.Effect<Option.Option<AccountKey.Record>, SqlError.SqlError>;
  }
>()("@stu/sync/server/AccountKeys") {}

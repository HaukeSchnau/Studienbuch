/**
 * ADR 0025's fresh sign-in: adding a passkey or a recovery wrapper, or deleting the account, needs
 * a session at most `Keys.freshSignInMinutes` old, by the database's clock that stamped it.
 */
import { Keys } from "@stu/api/Keys";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export * as FreshSignIn from "./FreshSignIn.ts";

/** Whether the account's session signed in recently enough to add a way in. */
export const isFresh = Effect.fn("FreshSignIn.isFresh")(function* (
  account: string,
  session: string,
) {
  const sql = yield* SqlClient.SqlClient;

  const fresh = yield* sql`
    select 1 from auth_session
    where id = ${session} and "userId" = ${account}
      and "createdAt" > now() - make_interval(mins => ${Keys.freshSignInMinutes})
  `;

  return fresh.length > 0;
});

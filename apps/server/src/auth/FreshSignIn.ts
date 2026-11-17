import { Keys } from "@stu/api/Keys";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export * as FreshSignIn from "./FreshSignIn.ts";

/**
 * Whether the account's session signed in at most `Keys.freshSignInMinutes` ago, so a thief with an
 * unlocked device can't quietly add a way in or delete the account. Renewals don't count: Better
 * Auth keeps `createdAt` and moves only the expiry.
 */
export const check = Effect.fn("FreshSignIn.check")(function* (account: string, session: string) {
  const sql = yield* SqlClient.SqlClient;

  const [fresh] = yield* sql`
    select 1 from auth_session
    where id = ${session} and "userId" = ${account}
      and "createdAt" > now() - make_interval(mins => ${Keys.freshSignInMinutes})
  `;

  return fresh !== undefined;
});

import { describe, expect, layer } from "@effect/vitest";
import { Postgres18 } from "@stu/sync/testing";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";
import { DatabaseTesting } from "../infra/database/DatabaseTesting.ts";
import { SchoolTesting } from "../school/SchoolTesting.ts";
import { CardLogins } from "./CardLogins.ts";

/** A card's login as the device sends it: 32 bytes, base64url. */
const loginOf = (fill: number) => Base64Url.encode(new Uint8Array(32).fill(fill));

describe.skipIf(Postgres18.socket === null)("CardLogins on PostgreSQL 18", () => {
  layer(SchoolTesting.database)((it) => {
    // Whoever found the old card may be signing in with it at the moment the student replaces it.
    it.effect(
      "signs out a sign-in with the old card that was under way while the card was replaced",
      () =>
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;

          yield* sql`
          insert into auth_user (id, name, email, "emailVerified")
          values ('noa', '', 'noa7x@konto.placeholder.invalid', false)
        `;

          const session = (id: string) => sql`
          insert into auth_session (id, "expiresAt", token, "userId")
          values (${id}, now() + interval '90 days', ${id}, 'noa')
        `;

          // The student's device, which makes the new card.
          yield* session("noa-student");
          yield* sql.withTransaction(CardLogins.replace("noa", loginOf(1), "noa-student"));
          const checked = yield* Deferred.make<void>();
          const go = yield* Deferred.make<void>();

          // Better Auth makes the session once the login checked out; here it waits for `go`.
          const finder = yield* Effect.forkChild(
            CardLogins.signingIn(loginOf(1), (account) =>
              Effect.gen(function* () {
                yield* Deferred.succeed(checked, undefined);
                yield* Deferred.await(go);
                yield* session("noa-finder");

                return account;
              }),
            ),
          );

          yield* Deferred.await(checked);

          const replacing = yield* Effect.forkChild(
            sql.withTransaction(CardLogins.replace("noa", loginOf(2), "noa-student")),
          );

          // The replacement waits for the sign-in, unless nothing makes it.
          yield* Effect.raceFirst(
            DatabaseTesting.someoneWaits,
            Effect.asVoid(Fiber.await(replacing)),
          );
          yield* Deferred.succeed(go, undefined);

          const signedIn = yield* Fiber.join(finder);
          const ended = yield* Fiber.join(replacing);

          const sessions = yield* sql<{ readonly id: string }>`
          select id from auth_session where "userId" = 'noa' order by id
        `;

          expect({
            signedIn,
            ended,
            sessions: sessions.map(({ id }) => id),
            old: yield* CardLogins.owner(loginOf(1)),
          }).toEqual({
            signedIn: Option.some("noa"),
            ended: Option.some(["noa-finder"]),
            sessions: ["noa-student"],
            old: Option.none(),
          });
        }),
    );
  });
});
